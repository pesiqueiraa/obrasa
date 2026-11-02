"""Verificação de atraso (docs/06, "Agendamento": diariamente às 20h).

Para cada indicador e cada mapa por estado, confere se a divulgação do período seguinte
já passou e o banco ainda não tem esse período. Atraso vira erro no relatório, o job sai
com 1 e o GitHub Actions avisa por e-mail. Sem isso, uma fonte que para de publicar (ou
um job que para de rodar) deixa o site com dado velho sem ninguém saber.

A regra é a mesma de `delayStatus` em apps/web/src/lib/indicator.ts, que mostra
"Atrasado desde" na página; os testes de pipelines/tests/test_atrasos.py repetem os
casos do site. Mudou uma, mude a outra.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from pipelines import config
from pipelines.config import Registry
from pipelines.jobs.report import Report

log = logging.getLogger(__name__)

# Prazo sem calendário da fonte: 1º dia do último período + `meses`, + `dias` − 1.
# Série diária: o próprio último dia + 5 dias corridos (fim de semana e feriado).
FOLGA_SEM_CALENDARIO = {
    "diaria": (0, 5),
    "mensal": (2, 14),
    "trimestral_movel": (2, 14),
    "trimestral": (6, 14),
    "anual": (30, 14),  # PNAD anual: o ano N sai em junho de N+1
}
PASSO_MESES = {"mensal": 1, "trimestral_movel": 1, "trimestral": 3, "anual": 12}


@dataclass(frozen=True)
class Divulgacao:
    ref_date: date
    proxima_divulgacao: date


def soma_meses(d: date, n: int) -> date:
    total = d.year * 12 + d.month - 1 + n
    return date(total // 12, total % 12 + 1, 1)


def proxima(releases: list[Divulgacao], ultimo: date) -> Divulgacao | None:
    """Próxima divulgação agendada para um período posterior ao último disponível."""
    futuras = sorted(
        (r for r in releases if r.ref_date > ultimo), key=lambda r: r.proxima_divulgacao
    )
    return futuras[0] if futuras else None


def atrasado_desde(
    ultimo: date,
    frequencia: str,
    prox: Divulgacao | None,
    hoje: date,
    folga: tuple[int, int] | None = None,
) -> date | None:
    """Dia a partir do qual o dado está atrasado, ou None se está em dia.

    `folga` é o `prazo` da série em config (substitui o padrão da frequência)."""
    passo = PASSO_MESES.get(frequencia)
    if prox and passo and prox.ref_date == soma_meses(ultimo, passo):
        prazo = prox.proxima_divulgacao
    elif folga or frequencia in FOLGA_SEM_CALENDARIO:
        meses, dias = folga or FOLGA_SEM_CALENDARIO[frequencia]
        base = ultimo if frequencia == "diaria" else soma_meses(ultimo, meses)
        prazo = base + timedelta(days=dias - 1)
    else:
        return None
    desde = prazo + timedelta(days=1)
    return desde if hoje >= desde else None


def escolhe(principal: date | None, reserva: date | None) -> tuple[date | None, bool]:
    """Último período exibido e se veio da reserva (mesma regra de chooseSeries)."""
    if reserva and (principal is None or reserva > principal):
        return reserva, True
    return principal, False


def _ultimo(conn: psycopg.Connection, series_id: str) -> date | None:
    row = conn.execute(
        "select max(ref_date) from observations_current where series_id = %s", (series_id,)
    ).fetchone()
    return row[0] if row else None


def _divulgacoes(conn: psycopg.Connection, series_id: str) -> list[Divulgacao]:
    rows = conn.execute(
        "select ref_date, proxima_divulgacao from releases "
        "where series_id = %s and proxima_divulgacao is not null",
        (series_id,),
    ).fetchall()
    return [Divulgacao(r[0], r[1]) for r in rows]


def _ultimo_mapa(conn: psycopg.Connection, mapa_id: str) -> date | None:
    # Só conta período com as 27 UFs, como o site (apps/web/src/lib/regional.ts).
    row = conn.execute(
        "select max(ref_date) from (select ref_date from observacoes_uf_atual "
        "where mapa_id = %s group by ref_date having count(*) = 27) p",
        (mapa_id,),
    ).fetchone()
    return row[0] if row else None


def _fmt(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def run(conn: psycopg.Connection, store, registry: Registry, today: date | None = None) -> Report:
    hoje = today or datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    report = Report()
    series = {s.id: s for s in registry.series}

    for ind in registry.indicators:
        principal = ind.fonte_primaria.series_id
        reserva = ind.fonte_reserva.series_id if ind.fonte_reserva else None
        ultimo, usando_reserva = escolhe(
            _ultimo(conn, principal), _ultimo(conn, reserva) if reserva else None
        )
        if ultimo is None:
            report.errors.append(f"{ind.slug}: nenhuma observação no banco")
            continue
        escolhida = reserva if usando_reserva else principal
        # A agenda vem do órgão que produz o dado (fonte principal), como no site.
        prox = proxima(_divulgacoes(conn, principal), ultimo)
        s = series[escolhida]
        desde = atrasado_desde(ultimo, s.frequencia, prox, hoje, s.prazo)
        if desde:
            report.errors.append(
                f"{ind.slug}: atrasado desde {_fmt(desde)} "
                f"(último período {_fmt(ultimo)}, série {escolhida})"
            )

    for m in config.load_regional(registry=registry).mapas:
        ultimo = _ultimo_mapa(conn, m.id)
        if ultimo is None:
            report.errors.append(f"mapa {m.id}: nenhum período com as 27 UFs no banco")
            continue
        desde = atrasado_desde(ultimo, m.frequencia, None, hoje, m.prazo)
        if desde:
            report.errors.append(
                f"mapa {m.id}: atrasado desde {_fmt(desde)} (último período {_fmt(ultimo)})"
            )

    if not report.errors:
        log.info(
            "%d indicadores e mapas por estado em dia em %s", len(registry.indicators), _fmt(hoje)
        )
    return report
