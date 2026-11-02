"""Job do IPCA: IBGE (fonte principal) e Banco Central (reserva).

Ordem de cada coleta: buscar → guardar resposta bruta → validar → gravar.
Se a validação falhar, nada daquela fonte é gravado (só a resposta bruta, para
diagnóstico) e o job termina com erro, o que dispara o alerta do GitHub Actions.
"""

from __future__ import annotations

import itertools
import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import psycopg

from pipelines import db
from pipelines.config import Registry
from pipelines.models import Observation, ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import bcb_sgs, ibge_agregados
from pipelines.transforms.acumulados import acumulado_12m, compare

log = logging.getLogger(__name__)

TABELA = 1737
VAR_MENSAL, VAR_12M, VAR_INDICE = 63, 2265, 2266
VARIAVEIS = [VAR_MENSAL, VAR_12M, VAR_INDICE]
PRODUTO_CALENDARIO = 9256
SERIES_IBGE = {
    VAR_MENSAL: "ibge_agregados_1737_63",
    VAR_12M: "ibge_agregados_1737_2265",
    VAR_INDICE: "ibge_agregados_1737_2266",
}
SGS_MENSAL, SGS_12M = 433, 13522
SERIES_BCB = {SGS_MENSAL: "bcb_sgs_433", SGS_12M: "bcb_sgs_13522"}

# Faixas plausíveis (docs/06, "Testes"). Incluem a hiperinflação de 1980–1994.
FAIXA_MENSAL = (Decimal("-5"), Decimal("100"))
FAIXA_12M = (Decimal("-10"), Decimal("10000"))


def _check_range(obs: list[Observation], lo: Decimal, hi: Decimal, nome: str) -> None:
    for o in obs:
        if not lo <= o.value <= hi:
            raise ValidationError(f"{nome}: {o.value} em {o.ref_date} fora da faixa [{lo}, {hi}]")


def _check_no_gaps(obs: list[Observation], nome: str) -> None:
    for prev, cur in itertools.pairwise(obs):
        months = (
            (cur.ref_date.year - prev.ref_date.year) * 12 + cur.ref_date.month - prev.ref_date.month
        )
        if months != 1:
            raise ValidationError(f"{nome}: buraco entre {prev.ref_date} e {cur.ref_date}")


def validate_ipca(mensal: list[Observation], acum_12m: list[Observation], nome: str) -> int:
    """Valida faixas, continuidade e confere o acumulado publicado com o encadeado.

    Devolve quantos meses foram conferidos. Falha com ValidationError.
    """
    if not mensal or not acum_12m:
        raise ValidationError(f"{nome}: série vazia")
    _check_range(mensal, *FAIXA_MENSAL, f"{nome} mensal")
    _check_range(acum_12m, *FAIXA_12M, f"{nome} 12 meses")
    _check_no_gaps(mensal, f"{nome} mensal")
    _check_no_gaps(acum_12m, f"{nome} 12 meses")
    compared, divergences = compare(acumulado_12m(mensal), acum_12m)
    if compared == 0:
        raise ValidationError(f"{nome}: nenhum mês para conferir o acumulado")
    if divergences:
        d = divergences[-1]
        raise ValidationError(
            f"{nome}: acumulado publicado diverge do encadeado em {len(divergences)} meses; "
            f"último {d.ref_date}: publicado {d.published}, encadeado {d.computed:.4f}"
        )
    return compared


def compare_sources(primary: list[Observation], reserve: list[Observation]) -> list[date]:
    """Meses em que a reserva (BCB) difere da fonte principal (IBGE)."""
    pri = {o.ref_date: o.value for o in primary}
    return [o.ref_date for o in reserve if o.ref_date in pri and pri[o.ref_date] != o.value]


@dataclass
class Report:
    summaries: list[db.WriteSummary] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def collect_ibge(conn: psycopg.Connection, store: RawStore, report: Report) -> list[Observation]:
    raw_periods = ibge_agregados.fetch_periods(TABELA)
    store.save(raw_periods, f"{TABELA}_periodos")
    periods = ibge_agregados.parse_periods(raw_periods.body)
    first, last = min(periods), max(periods)

    span = f"{ibge_agregados.date_to_period(first)}-{ibge_agregados.date_to_period(last)}"
    raw = ibge_agregados.fetch_variables(TABELA, VARIAVEIS, span)
    raw_object = store.save(raw, f"{TABELA}_{'-'.join(map(str, VARIAVEIS))}")
    data = ibge_agregados.parse_variables(raw.body, VARIAVEIS)

    checked = validate_ipca(data[VAR_MENSAL], data[VAR_12M], "IBGE 1737")
    if data[VAR_12M][-1].ref_date != last:
        raise ValidationError(f"IBGE 1737: último período {last} sem acumulado em 12 meses")
    if any(o.value <= 0 for o in data[VAR_INDICE]):
        raise ValidationError("IBGE 1737/2266: número-índice não positivo")
    log.info("IBGE 1737: acumulado conferido com o encadeado em %s meses", checked)

    with conn.transaction():
        for var, series_id in SERIES_IBGE.items():
            summary = db.write_observations(
                conn, series_id, data[var], collected_at=raw.fetched_at, raw_object=raw_object
            )
            report.summaries.append(summary)
            if summary.missing_in_source:
                report.warnings.append(
                    f"{series_id}: {len(summary.missing_in_source)} períodos no banco sumiram da fonte"
                )
            db.upsert_released(conn, series_id, periods)
    return data[VAR_12M]


def collect_calendar(conn: psycopg.Connection, store: RawStore, today: date) -> int:
    raw = ibge_agregados.fetch_calendar(
        PRODUTO_CALENDARIO, today - timedelta(days=45), today + timedelta(days=400)
    )
    store.save(raw, f"calendario_{PRODUTO_CALENDARIO}")
    scheduled = ibge_agregados.parse_calendar(raw.body, PRODUTO_CALENDARIO)
    upcoming = {s.ref_date: s.released_at.date() for s in scheduled}
    with conn.transaction():
        for series_id in SERIES_IBGE.values():
            db.upsert_scheduled(conn, series_id, upcoming)
    return len(upcoming)


def collect_bcb(
    conn: psycopg.Connection, store: RawStore, report: Report, today: date
) -> dict[int, list[Observation]]:
    parsed: dict[int, list[Observation]] = {}
    raws = {}
    for codigo in (SGS_MENSAL, SGS_12M):
        raw = bcb_sgs.fetch(codigo, date(1979, 12, 1), today)
        raws[codigo] = (raw, store.save(raw, f"sgs_{codigo}"))
        parsed[codigo] = bcb_sgs.parse(raw.body)

    validate_ipca(parsed[SGS_MENSAL], parsed[SGS_12M], "BCB SGS")

    with conn.transaction():
        for codigo, series_id in SERIES_BCB.items():
            raw, raw_object = raws[codigo]
            report.summaries.append(
                db.write_observations(
                    conn,
                    series_id,
                    parsed[codigo],
                    collected_at=raw.fetched_at,
                    raw_object=raw_object,
                )
            )
    return parsed


def run(
    conn: psycopg.Connection, store: RawStore, registry: Registry, today: date | None = None
) -> Report:
    today = today or datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    report = Report()
    with conn.transaction():
        db.sync_registry(conn, registry)

    ibge_12m: list[Observation] | None = None
    try:
        ibge_12m = collect_ibge(conn, store, report)
    except Exception as exc:  # cada fonte falha sozinha; o job termina com erro no fim
        log.exception("coleta do IBGE falhou")
        report.errors.append(f"IBGE: {exc}")

    try:
        n = collect_calendar(conn, store, today)
        log.info("calendário do IBGE: %s divulgações agendadas", n)
    except Exception as exc:
        log.exception("calendário do IBGE falhou")
        report.errors.append(f"calendário IBGE: {exc}")

    try:
        bcb = collect_bcb(conn, store, report, today)
        if ibge_12m is not None:
            diverge = compare_sources(ibge_12m, bcb[SGS_12M])
            if diverge:
                report.errors.append(
                    f"BCB 13522 diverge do IBGE 1737/2265 em {len(diverge)} meses (último {diverge[-1]})"
                )
    except Exception as exc:
        log.exception("coleta do BCB falhou")
        report.errors.append(f"BCB SGS: {exc}")

    return report
