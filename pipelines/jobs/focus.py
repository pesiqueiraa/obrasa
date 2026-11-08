"""Expectativas do Focus para os indicadores com `focus` em config/indicators.yaml.

Busca a pesquisa mais recente e grava as medianas anuais (tabela expectativas, só INSERT).
Pesquisa já gravada não é gravada de novo. Se faltar algum indicador pedido, nada é gravado.
"""

from __future__ import annotations

import logging

import psycopg

from pipelines import db
from pipelines.config import Registry
from pipelines.jobs.report import Report
from pipelines.raw_store import RawStore
from pipelines.sources import bcb_focus

log = logging.getLogger(__name__)


def run(conn: psycopg.Connection, store: RawStore, registry: Registry) -> Report:
    report = Report()
    indicadores = {i.focus for i in registry.indicators if i.focus}
    if not indicadores:
        return report
    with conn.transaction():
        db.sync_registry(conn, registry)

    raw_data = bcb_focus.fetch_ultima_data()
    store.save(raw_data, "focus_ultima_data")
    dia = bcb_focus.parse_ultima_data(raw_data.body)
    with conn.cursor() as cur:
        cur.execute("select 1 from expectativas where data_pesquisa = %s limit 1", (dia,))
        if cur.fetchone():
            log.info("Focus: pesquisa de %s já gravada", dia)
            return report

    raw = bcb_focus.fetch_pesquisa(dia)
    objeto = store.save(raw, f"focus_{dia:%Y%m%d}")
    itens = bcb_focus.parse_pesquisa(raw.body, indicadores, dia)
    with conn.transaction(), conn.cursor() as cur:
        cur.executemany(
            """
            insert into expectativas (source_id, indicador, data_pesquisa, ano_referencia, mediana,
                                      respondentes, base_calculo, coletado_em, raw_object)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict do nothing
            """,
            [
                (
                    bcb_focus.SOURCE_ID,
                    e.indicador,
                    e.data_pesquisa,
                    e.ano_referencia,
                    e.mediana,
                    e.respondentes,
                    bcb_focus.BASE_CALCULO,
                    raw.fetched_at,
                    objeto,
                )
                for e in itens
            ],
        )
    log.info("Focus: %d medianas da pesquisa de %s", len(itens), dia)
    return report
