"""Mapas por estado: variáveis do IBGE no nível UF (config/regional.yaml). Ver docs/05.

Cada mapa é buscado, validado (27 UFs, classificação pedida, faixa plausível) e
gravado em observacoes_uf. Falha de um mapa não impede os outros.
"""

from __future__ import annotations

import logging

import psycopg

from pipelines import config
from pipelines.config import MapaUf, Registry
from pipelines.jobs.report import Report
from pipelines.models import ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import ibge_agregados

log = logging.getLogger(__name__)


def valida_faixa(m: MapaUf, dados: dict) -> None:
    lo, hi = m.faixa
    for uf, serie in dados.items():
        for ref, v in serie.valores.items():
            if not lo <= v <= hi:
                raise ValidationError(f"{m.id}: UF {uf} em {ref} = {v}, fora da faixa {lo}–{hi}")


def coleta(conn: psycopg.Connection, store: RawStore, m: MapaUf) -> int:
    raw = ibge_agregados.fetch_uf(m.tabela, m.variavel, m.periodos, m.classificacao)
    objeto = store.save(raw, f"uf_{m.id}")
    dados = ibge_agregados.parse_uf(
        raw.body, m.variavel, classificacao=m.classificacao, tipo=m.frequencia
    )
    valida_faixa(m, dados)
    linhas = [
        (
            m.id,
            ibge_agregados.SOURCE_ID,
            f"{m.tabela}/{m.variavel}",
            m.classificacao,
            uf,
            s.nome,
            ref,
            v,
        )
        for uf, s in dados.items()
        for ref, v in s.valores.items()
    ]
    with conn.transaction(), conn.cursor() as cur:
        cur.executemany(
            """
            insert into observacoes_uf (mapa_id, source_id, codigo_externo, classificacao, uf,
                                        uf_nome, ref_date, value, collected_at, raw_object)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (mapa_id, uf, ref_date) do update set value = excluded.value,
              uf_nome = excluded.uf_nome,
              collected_at = excluded.collected_at, raw_object = excluded.raw_object
            """,
            [(*linha, raw.fetched_at, objeto) for linha in linhas],
        )
    return len(linhas)


def run(conn: psycopg.Connection, store: RawStore, registry: Registry) -> Report:
    report = Report()
    for m in config.load_regional(registry=registry).mapas:
        try:
            n = coleta(conn, store, m)
            log.info("%s: %d valores por UF", m.id, n)
        except Exception as exc:
            log.exception("mapa %s falhou", m.id)
            report.errors.append(f"mapa {m.id}: {exc}")
    return report
