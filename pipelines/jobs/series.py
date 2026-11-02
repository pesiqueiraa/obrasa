"""Job genérico: coleta as séries de config/sources.yaml com `coletor: series`.

Para cada série: buscar → guardar resposta bruta → validar → gravar. As regras de
validação são as mesmas para todas (docs/06, "Testes"):
  * nenhum valor fora da faixa plausível declarada na série;
  * nenhum período no futuro (a meta Selic traz datas até a próxima reunião);
  * sem buraco entre períodos, exceto em séries diárias (dias úteis variam);
  * pelo menos uma observação.
Se uma série falhar, nada dela é gravado e o erro vai para o relatório; as outras
séries seguem.
"""

from __future__ import annotations

import itertools
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from pipelines import db
from pipelines.config import Registry, Series
from pipelines.jobs.report import Report
from pipelines.models import Observation, ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import bcb_sgs, ibge_agregados

log = logging.getLogger(__name__)

# Passo esperado entre períodos consecutivos, em meses.
PASSO_MESES = {"mensal": 1, "trimestral_movel": 1, "trimestral": 3, "anual": 12}
INICIO_PADRAO = date(1980, 1, 1)


def _months_between(a: date, b: date) -> int:
    return (b.year - a.year) * 12 + b.month - a.month


def validate(obs: list[Observation], s: Series, today: date) -> None:
    """Falha com ValidationError se a série não passar nas regras do módulo."""
    if not obs:
        raise ValidationError(f"{s.id}: nenhuma observação")
    if s.faixa is None:
        raise ValidationError(f"{s.id}: série sem faixa plausível declarada")
    lo, hi = s.faixa
    for o in obs:
        if not lo <= o.value <= hi:
            raise ValidationError(f"{s.id}: {o.value} em {o.ref_date} fora da faixa [{lo}, {hi}]")
        if o.ref_date > today:
            raise ValidationError(f"{s.id}: período no futuro ({o.ref_date})")
    passo = PASSO_MESES.get(s.frequencia)
    if passo is None:
        return
    lacunas = set(s.lacunas)
    for prev, cur in itertools.pairwise(obs):
        n = _months_between(prev.ref_date, cur.ref_date)
        faltam = {
            date(prev.ref_date.year + (prev.ref_date.month - 1 + k) // 12,
                 (prev.ref_date.month - 1 + k) % 12 + 1, 1)
            for k in range(passo, n, passo)
        }  # fmt: skip
        if n % passo or not faltam <= lacunas:
            raise ValidationError(f"{s.id}: buraco entre {prev.ref_date} e {cur.ref_date}")


def collect_sgs(
    conn: psycopg.Connection, store: RawStore, report: Report, s: Series, today: date
) -> None:
    codigo = int(s.codigo_externo)
    inicio = s.desde or INICIO_PADRAO
    janelas = bcb_sgs.windows(inicio, today) if s.frequencia == "diaria" else [(inicio, today)]
    raw_by_date: dict[date, str] = {}
    obs: list[Observation] = []
    fetched_at: datetime | None = None
    for a, b in janelas:
        raw = bcb_sgs.fetch(codigo, a, b)
        raw_object = store.save(raw, f"sgs_{codigo}_{a:%Y%m%d}")
        fetched_at = raw.fetched_at
        parsed = bcb_sgs.parse(raw.body, monthly=s.frequencia != "diaria")
        for o in parsed:
            raw_by_date[o.ref_date] = raw_object
        obs.extend(parsed)

    # A meta Selic (432) repete o valor vigente até a próxima reunião, com datas futuras.
    obs = sorted((o for o in obs if o.ref_date <= today), key=lambda o: o.ref_date)
    validate(obs, s, today)
    assert fetched_at is not None
    with conn.transaction():
        report.summaries.append(
            db.write_observations(conn, s.id, obs, collected_at=fetched_at, raw_object=raw_by_date)
        )


def collect_ibge_table(
    conn: psycopg.Connection,
    store: RawStore,
    report: Report,
    tabela: int,
    group: list[Series],
    today: date,
    calendars: dict[int, dict[date, date]],
) -> None:
    """Coleta, numa requisição, as variáveis de uma tabela com a mesma classificação."""
    tipo = group[0].frequencia
    classificacao = group[0].classificacao
    variaveis = [int(s.codigo_externo.split("/")[1]) for s in group]

    raw_periods = ibge_agregados.fetch_periods(tabela)
    store.save(raw_periods, f"{tabela}_periodos")
    periods = ibge_agregados.parse_periods(raw_periods.body, tipo)
    inicio = max(min(periods), group[0].desde) if group[0].desde else min(periods)
    span = (
        f"{ibge_agregados.date_to_period(inicio, tipo)}"
        f"-{ibge_agregados.date_to_period(max(periods), tipo)}"
    )
    raw = ibge_agregados.fetch_variables(tabela, variaveis, span, classificacao)
    raw_object = store.save(raw, f"{tabela}_{'-'.join(map(str, variaveis))}")
    data = ibge_agregados.parse_variables(
        raw.body, variaveis, classificacao=classificacao, tipo=tipo
    )
    for s, var in zip(group, variaveis, strict=True):
        validate(data[var], s, today)

    with conn.transaction():
        for s, var in zip(group, variaveis, strict=True):
            summary = db.write_observations(
                conn, s.id, data[var], collected_at=raw.fetched_at, raw_object=raw_object
            )
            report.summaries.append(summary)
            if summary.missing_in_source:
                report.warnings.append(
                    f"{s.id}: {len(summary.missing_in_source)} períodos no banco sumiram da fonte"
                )
            db.upsert_released(conn, s.id, {d: at for d, at in periods.items() if d >= inicio})
            if s.calendario in calendars:
                db.upsert_scheduled(conn, s.id, calendars[s.calendario])


def collect_calendars(
    store: RawStore, produtos: set[int], today: date
) -> dict[int, dict[date, date]]:
    out = {}
    for produto in sorted(produtos):
        raw = ibge_agregados.fetch_calendar(
            produto, today - timedelta(days=45), today + timedelta(days=400)
        )
        store.save(raw, f"calendario_{produto}")
        scheduled = ibge_agregados.parse_calendar(raw.body, produto)
        out[produto] = {r.ref_date: r.released_at.date() for r in scheduled}
    return out


def run(
    conn: psycopg.Connection, store: RawStore, registry: Registry, today: date | None = None
) -> Report:
    today = today or datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    report = Report()
    with conn.transaction():
        db.sync_registry(conn, registry)

    todas = [s for s in registry.series if s.coletor == "series"]

    produtos = {s.calendario for s in todas if s.calendario}
    calendars: dict[int, dict[date, date]] = {}
    try:
        calendars = collect_calendars(store, produtos, today)
    except Exception as exc:  # sem calendário, a coleta segue; a tela usa o prazo padrão
        log.exception("calendário do IBGE falhou")
        report.errors.append(f"calendário IBGE: {exc}")

    for s in (s for s in todas if s.source_id == "bcb_sgs"):
        try:
            collect_sgs(conn, store, report, s, today)
        except Exception as exc:  # cada série falha sozinha
            log.exception("coleta de %s falhou", s.id)
            report.errors.append(f"{s.id}: {exc}")

    groups: dict[tuple[int, str | None, str], list[Series]] = defaultdict(list)
    for s in (s for s in todas if s.source_id == "ibge_agregados"):
        tabela = int(s.codigo_externo.split("/")[0])
        groups[(tabela, s.classificacao, s.frequencia)].append(s)
    for (tabela, _, _), group in groups.items():
        try:
            collect_ibge_table(conn, store, report, tabela, group, today, calendars)
        except Exception as exc:
            log.exception("coleta da tabela %s falhou", tabela)
            report.errors.append(f"IBGE {tabela}: {exc}")

    return report
