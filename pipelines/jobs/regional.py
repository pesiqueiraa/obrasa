"""Mapas por estado: variáveis do IBGE no nível UF (config/regional.yaml). Ver docs/05.

Cada mapa tem a descrição conferida na fonte (pipelines/metadados.py), é buscado,
validado (27 UFs, classificação pedida, faixa plausível) e
gravado em observacoes_uf. Falha de um mapa não impede os outros.

Como em observations, nada é sobrescrito: valor revisado pelo IBGE vira linha nova com
revision + 1 (o banco recusa UPDATE nessa tabela) e o site lê observacoes_uf_atual.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

import psycopg

from pipelines import config, metadados, saltos
from pipelines.config import MapaUf, Registry
from pipelines.jobs.report import Report
from pipelines.models import Observation, ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import ibge_agregados

log = logging.getLogger(__name__)


def valida_faixa(m: MapaUf, dados: dict) -> None:
    lo, hi = m.faixa
    for uf, serie in dados.items():
        for ref, v in serie.valores.items():
            if not lo <= v <= hi:
                raise ValidationError(f"{m.id}: UF {uf} em {ref} = {v}, fora da faixa {lo}–{hi}")


Chave = tuple[int, date]  # (código da UF, período)


def planeja(
    atual: dict[Chave, tuple[Decimal, int]], novos: dict[Chave, Decimal]
) -> list[tuple[int, date, Decimal, int]]:
    """O que inserir: período novo com revisão 0, valor diferente com revisão + 1."""
    out = []
    for (uf, ref), v in sorted(novos.items()):
        vigente = atual.get((uf, ref))
        if vigente is None:
            out.append((uf, ref, v, 0))
        elif vigente[0] != v:
            out.append((uf, ref, v, vigente[1] + 1))
    return out


@dataclass(frozen=True)
class Gravacao:
    novos: int
    revisados: int
    iguais: int


def coleta(
    conn: psycopg.Connection,
    store: RawStore,
    m: MapaUf,
    liberacoes=(),
    report: Report | None = None,
) -> Gravacao:
    raw_meta = ibge_agregados.fetch_metadata(m.tabela)
    store.save(raw_meta, f"uf_{m.id}_metadados")
    descricao = ibge_agregados.parse_metadata(raw_meta.body, m.variavel, m.classificacao)
    metadados.confere(m.na_fonte, descricao, f"mapa {m.id}")
    raw = ibge_agregados.fetch_uf(m.tabela, m.variavel, m.periodos, m.classificacao)
    objeto = store.save(raw, f"uf_{m.id}")
    dados = ibge_agregados.parse_uf(
        raw.body, m.variavel, classificacao=m.classificacao, tipo=m.frequencia
    )
    valida_faixa(m, dados)
    novos = {(uf, ref): v for uf, s in dados.items() for ref, v in s.valores.items()}
    nomes = {uf: s.nome for uf, s in dados.items()}

    def le_atual(cur) -> dict:
        cur.execute(
            "select uf, ref_date, value, revision from observacoes_uf_atual where mapa_id = %s",
            (m.id,),
        )
        return {(r[0], r[1]): (r[2], r[3]) for r in cur.fetchall()}

    # Checagem de salto por UF (pipelines/saltos.py), fora da transação da escrita: o
    # registro do salto visto precisa ficar gravado mesmo quando a coleta para.
    # Mapa em % é taxa; o resto, nível.
    with conn.cursor() as cur:
        atual = le_atual(cur)
    tipo = "taxa" if m.unidade.startswith("%") else "nivel"
    curtos = []
    rel = report if report is not None else Report()
    for uf in sorted(dados):
        serie = f"mapa/{m.id}/{uf}"
        hist = {ref: v for (u, ref), (v, _) in atual.items() if u == uf}
        obs = [Observation(ref, v) for (u, ref), v in novos.items() if u == uf]
        if saltos.confere_com_registro(conn, serie, tipo, hist, obs, liberacoes, rel).sem_historico:
            curtos.append(uf)
    if curtos and report is not None:
        report.warnings.append(
            f"mapa {m.id}: histórico curto para a checagem de salto em {len(curtos)} UFs"
        )
    with conn.transaction(), conn.cursor() as cur:
        atual = le_atual(cur)
        plano = planeja(atual, novos)
        cur.executemany(
            """
            insert into observacoes_uf (mapa_id, source_id, codigo_externo, classificacao, uf,
                                        uf_nome, ref_date, value, revision, collected_at,
                                        raw_object)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    m.id,
                    ibge_agregados.SOURCE_ID,
                    f"{m.tabela}/{m.variavel}",
                    m.classificacao,
                    uf,
                    nomes[uf],
                    ref,
                    v,
                    rev,
                    raw.fetched_at,
                    objeto,
                )
                for uf, ref, v, rev in plano
            ],
        )
    return Gravacao(
        novos=sum(1 for p in plano if p[3] == 0),
        revisados=sum(1 for p in plano if p[3] > 0),
        iguais=len(novos) - len(plano),
    )


def run(conn: psycopg.Connection, store: RawStore, registry: Registry) -> Report:
    report = Report()
    for m in config.load_regional(registry=registry).mapas:
        try:
            g = coleta(conn, store, m, registry.liberacoes, report)
            log.info(
                "%s: %d novos, %d revisados, %d sem mudança", m.id, g.novos, g.revisados, g.iguais
            )
            if g.revisados:
                report.warnings.append(f"mapa {m.id}: {g.revisados} valores revisados pela fonte")
        except Exception as exc:
            log.exception("mapa %s falhou", m.id)
            report.falhou(f"mapa {m.id}", exc)
    return report
