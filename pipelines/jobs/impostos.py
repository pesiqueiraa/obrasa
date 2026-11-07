"""Aba Impostos: marcos da linha do tempo e projetos em tramitação (config/impostos.yaml).

Marcos: copiados do arquivo para o banco a cada execução. O texto e os números vêm da lei
(fonte `planalto_legislacao`); a tela só mostra os que têm conferência humana.

Projetos: proposições da Câmara com tramitação nos últimos `camara.dias` dias e um dos
termos na ementa ou na indexação. A situação vem do detalhe de cada uma. A lista no banco
é trocada inteira; se a Câmara falhar, a lista anterior fica.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from pipelines import config, db
from pipelines.config import Registry
from pipelines.jobs.report import Report
from pipelines.models import ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import camara

log = logging.getLogger(__name__)
FONTE_LEI = "planalto_legislacao"
PAGINAS_MAX = 5


def grava_marcos(conn: psycopg.Connection, marcos: list[config.Marco]) -> None:
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from marcos_tributarios")
        cur.executemany(
            """
            insert into marcos_tributarios (source_id, id, vigencia, publico, titulo, texto, lei,
                                            url, conferido_por, conferido_em)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (FONTE_LEI, m.id, m.vigencia, m.publico, m.titulo, m.texto, m.lei, m.url,
                 m.conferido_por, m.conferido_em)
                for m in marcos
            ],
        )  # fmt: skip


def coleta_projetos(
    store: RawStore, cfg: config.Camara, hoje: date
) -> list[tuple[camara.Proposicao, str, datetime]]:
    inicio = hoje - timedelta(days=cfg.dias)
    ids: list[int] = []
    for termo in cfg.termos:
        for pagina in range(1, PAGINAS_MAX + 1):
            raw = camara.fetch_lista(cfg.tipos, termo, inicio, hoje, pagina)
            store.save(raw, f"camara_lista_{pagina}")
            novos, tem_proxima = camara.parse_lista(raw.body, cfg.termos)
            ids.extend(i for i in novos if i not in ids)
            if not tem_proxima:
                break
        else:
            log.warning("Câmara: termo %r passou de %d páginas", termo, PAGINAS_MAX)
    out = []
    for id_ in ids:
        raw = camara.fetch_detalhe(id_)
        objeto = store.save(raw, f"camara_{id_}")
        p = camara.parse_detalhe(raw.body)
        if p.sigla_tipo not in cfg.tipos:
            raise ValidationError(f"Câmara: {id_} é {p.sigla_tipo}, fora dos tipos pedidos")
        out.append((p, objeto, raw.fetched_at))
    out.sort(key=lambda t: t[0].ultima_tramitacao or datetime.min, reverse=True)
    return out[: cfg.maximo]


def grava_projetos(conn: psycopg.Connection, projetos) -> None:
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from proposicoes")
        cur.executemany(
            """
            insert into proposicoes (source_id, id, sigla_tipo, numero, ano, ementa, situacao,
                                     orgao, ultima_tramitacao, url, coletado_em, raw_object)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (camara.SOURCE_ID, p.id, p.sigla_tipo, p.numero, p.ano, p.ementa, p.situacao,
                 p.orgao,
                 p.ultima_tramitacao.replace(tzinfo=ZoneInfo("America/Sao_Paulo"))
                 if p.ultima_tramitacao else None,
                 p.url, quando, objeto)
                for p, objeto, quando in projetos
            ],
        )  # fmt: skip


def run(
    conn: psycopg.Connection, store: RawStore, registry: Registry, hoje: date | None = None
) -> Report:
    hoje = hoje or datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    report = Report()
    cfg = config.load_impostos()
    with conn.transaction():
        db.sync_registry(conn, registry)
    grava_marcos(conn, cfg.marcos)
    pendentes = [m.id for m in cfg.marcos if m.conferido_em is None]
    if pendentes:
        report.warnings.append(
            f"impostos: {len(pendentes)} marcos sem conferência humana, fora do site"
        )
    try:
        projetos = coleta_projetos(store, cfg.camara, hoje)
    except Exception as exc:  # a lista anterior continua no banco
        log.exception("Câmara falhou")
        report.errors.append(f"Câmara: {exc}")
        return report
    grava_projetos(conn, projetos)
    log.info("impostos: %d marcos, %d projetos", len(cfg.marcos), len(projetos))
    return report
