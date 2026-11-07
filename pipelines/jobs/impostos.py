"""Aba Impostos: marcos da linha do tempo e projetos em tramitação (config/impostos.yaml).

Marcos: copiados do arquivo para o banco a cada execução. Cada um é conferido contra o
texto da lei no normas.leg.br (pipelines/agentes/conferir_marcos.py): números pelo código,
leitura pelo modelo, citações pelo código. Só os aprovados ganham `conferido_em` e aparecem
no site. A conferência fica em `marcos_verificacoes` com o hash do marco e da lei; enquanto
o hash não muda, ela é reaproveitada sem chamar o modelo. Se o normas.leg.br falhar, os
marcos do banco ficam como estavam.

Projetos: proposições da Câmara com tramitação nos últimos `camara.dias` dias e um dos
termos na ementa ou na indexação. A situação vem do detalhe de cada uma. A lista no banco
é trocada inteira; se a Câmara falhar, a lista anterior fica.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from pipelines import config, db
from pipelines.agentes import conferir_marcos
from pipelines.config import Registry
from pipelines.jobs.report import Report
from pipelines.models import ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import camara, normas

log = logging.getLogger(__name__)
FONTE_LEI = "planalto_legislacao"
PAGINAS_MAX = 5
CHAMADAS_MAX = 20  # conferências pelo modelo por execução (teto de gasto)
CONFERIDO_POR = "Conferência automática: texto da lei no normas.leg.br, lido por código e por IA"


def grava_marcos(
    conn: psycopg.Connection,
    marcos: list[config.Marco],
    aprovados: dict[str, tuple[str, date]],
) -> None:
    """Troca os marcos do banco. `aprovados`: id → (hash, dia) da conferência aprovada."""
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from marcos_tributarios")
        cur.executemany(
            """
            insert into marcos_tributarios (source_id, id, vigencia, publico, titulo, texto, lei,
                                            url, dispositivos, conferido_por, conferido_em,
                                            verificacao_hash)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (FONTE_LEI, m.id, m.vigencia, m.publico, m.titulo, m.texto, m.lei, m.url,
                 m.dispositivos,
                 CONFERIDO_POR if m.id in aprovados else None,
                 aprovados[m.id][1] if m.id in aprovados else None,
                 aprovados[m.id][0] if m.id in aprovados else None)
                for m in marcos
            ],
        )  # fmt: skip


def baixa_normas(marcos: list[config.Marco]):
    """Baixa cada norma citada uma vez. Devolve {URN: dispositivos} e {URN: resposta}."""
    leis, brutos = {}, {}
    for urn in sorted({normas.norma_de(u) for m in marcos for u in m.dispositivos}):
        raw = normas.fetch(urn)
        leis[urn] = normas.parse(raw.body, urn)
        brutos[urn] = raw
    return leis, brutos


def _ultima(conn: psycopg.Connection, marco_id: str, h: str):
    return conn.execute(
        """
        select aprovado, verificado_em from marcos_verificacoes
        where marco_id = %s and hash = %s and conclusiva order by verificado_em desc limit 1
        """,
        (marco_id, h),
    ).fetchone()


def confere_marcos(
    conn: psycopg.Connection,
    store: RawStore,
    marcos: list[config.Marco],
    report: Report,
    client=None,
) -> dict[str, tuple[str, date]] | None:
    """Conferência de cada marco; None se não deu para ler as leis (banco fica como está)."""
    try:
        leis, brutos = baixa_normas(marcos)
    except Exception as exc:
        log.exception("normas.leg.br falhou")
        report.errors.append(f"normas.leg.br: {exc}")
        return None
    pode_chamar = client is not None or bool(os.environ.get("ANTHROPIC_API_KEY"))
    salvos: dict[str, str] = {}
    aprovados: dict[str, tuple[str, date]] = {}
    chamadas = 0
    for m in marcos:
        try:
            lei = conferir_marcos.texto_lei(m, leis)
        except ValidationError as exc:
            report.errors.append(f"marco {m.id}: {exc}")
            continue
        h = conferir_marcos.hash_de(m, lei)
        if anterior := _ultima(conn, m.id, h):
            if anterior[0]:
                aprovados[m.id] = (h, anterior[1].date())
            continue
        numeros_ok = not conferir_marcos.checa_numeros(m, lei)
        if numeros_ok and (not pode_chamar or chamadas >= CHAMADAS_MAX):
            report.warnings.append(f"marco {m.id}: conferência adiada (sem chave ou teto)")
            continue
        chamadas += numeros_ok
        c = conferir_marcos.confere(m, leis, client=client)
        citadas = sorted({normas.norma_de(u) for u in m.dispositivos})
        for urn in citadas:
            if urn not in salvos:
                salvos[urn] = store.save(brutos[urn], "normas_" + urn.rsplit(":", 1)[1])
        with conn.transaction():
            linha = conn.execute(
                """
                insert into marcos_verificacoes (marco_id, hash, aprovado, conclusiva, motivos,
                                                 afirmacoes, normas, modelo, versao_prompt,
                                                 custo_usd)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning verificado_em
                """,
                (m.id, h, c.aprovado, c.conclusiva, c.motivos, json.dumps(c.afirmacoes, ensure_ascii=False),
                 json.dumps({u: salvos[u] for u in citadas}), c.modelo,
                 conferir_marcos.VERSAO_PROMPT, c.custo_usd),
            ).fetchone()  # fmt: skip
        if c.aprovado:
            aprovados[m.id] = (h, linha[0].date())
        elif c.conclusiva:
            report.warnings.append(f"marco {m.id} reprovado, fora do site: {'; '.join(c.motivos)}")
        else:
            report.warnings.append(f"marco {m.id}: conferência inconclusiva, tenta de novo")
    return aprovados


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
    conn: psycopg.Connection,
    store: RawStore,
    registry: Registry,
    hoje: date | None = None,
    client=None,
) -> Report:
    hoje = hoje or datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    report = Report()
    cfg = config.load_impostos()
    with conn.transaction():
        db.sync_registry(conn, registry)
    aprovados = confere_marcos(conn, store, cfg.marcos, report, client)
    if aprovados is not None:
        grava_marcos(conn, cfg.marcos, aprovados)
    try:
        projetos = coleta_projetos(store, cfg.camara, hoje)
    except Exception as exc:  # a lista anterior continua no banco
        log.exception("Câmara falhou")
        report.errors.append(f"Câmara: {exc}")
        return report
    grava_projetos(conn, projetos)
    log.info(
        "impostos: %d marcos, %d no site, %d projetos",
        len(cfg.marcos), len(aprovados or {}), len(projetos),
    )  # fmt: skip
    return report
