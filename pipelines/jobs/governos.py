"""Aba Governos (docs/10, 3.7.1; decisão D27): mandatos e metas de inflação.

Mandatos (config/governos.yaml): só vão para o banco depois de conferidos, sem ninguém
liberar. Cada prova precisa ter o trecho, literalmente, no texto citado: o dispositivo da
Constituição no normas.leg.br, na versão que valia na posse, ou a página da matéria no
Senado. Além disso, o código exige que

  * a data de início apareça numa prova: posse em 1º de janeiro precisa de prova que fale
    em janeiro (art. 82 da Constituição); outra data precisa estar escrita (dd/mm/aaaa);
  * o fim de cada mandato seja a véspera do início do seguinte; o último fica em curso.

  * a foto de cada mandato exista no Wikimedia Commons com a mesma licença e o mesmo
    autor escritos na config (critério: retrato oficial do mandato; sem retrato próprio,
    o mais recente da pessoa até a posse).

Qualquer falha deixa a lista do banco como estava (falha fechada).

Metas de inflação: lidas da página de histórico de metas do Banco Central
(pipelines/sources/bcb_metas.py). O IPCA efetivo de cada ano na página precisa ser igual
ao IPCA de 12 meses de dezembro gravado no banco (IBGE 1737/2265); se divergir, nada é
gravado. A tabela do banco é trocada inteira a cada coleta.

Planos (bloco 3): o PDF do plano registrado no TSE pela candidatura eleita, lido de dentro do
pacote de planos do ano. Se o PDF, o prompt, o modelo ou a lista de indicadores mudarem (hash),
o job confere no arquivo de candidaturas que o candidato é o eleito para presidente e roda o
agente localizar_promessas, que só é aceito se cada trecho existir na página citada. Recusa
mantém os trechos anteriores.

Normas do período (bloco 4): todas as emendas à Constituição e leis complementares desde o
ano anterior ao primeiro mandato, da lista de legislação do Senado. A numeração de cada
tipo precisa vir sem buraco nem repetição; se não vier, nada é gravado. "Impostos" é a
expressão de config/governos.yaml sobre a ementa oficial.
"""

from __future__ import annotations

import gzip
import html
import logging
import os
import re
from dataclasses import replace
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import psycopg
from psycopg.types.json import Jsonb

from pipelines import config, db, http
from pipelines.agentes import localizar_promessas, nucleo
from pipelines.config import Governos, Mandato, Registry
from pipelines.jobs.report import Report
from pipelines.models import RawResponse, ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import bcb_metas, commons, normas, senado_legislacao, tse

log = logging.getLogger(__name__)
SERIE_IPCA_12M = "ibge_agregados_1737_2265"
FONTE_SENADO = "senado_materias"
_ZW = re.compile("[​‌‍﻿]")


def normaliza(texto: str) -> str:
    """Texto puro para comparar trechos: sem tags, entidades, espaço duplo nem zero-width."""
    sem = re.sub(r"<[^>]+>", " ", texto)
    return re.sub(r"\s+", " ", _ZW.sub("", html.unescape(sem))).strip()


def baixa_textos(
    g: Governos, store: RawStore
) -> tuple[dict[tuple[str, str], str], dict[str, str], dict[str, str]]:
    """Lê cada norma e página citada uma vez.

    Devolve ({(urn do dispositivo, versão): texto}, {url: texto}, {urn ou url: objeto bruto}).
    """
    dispositivos: dict[tuple[str, str], str] = {}
    paginas: dict[str, str] = {}
    brutos: dict[str, str] = {}
    provas = [p for m in g.mandatos for p in m.provas]
    por_norma: dict[str, set[str]] = {}
    for p in provas:
        if p.urn:
            por_norma.setdefault(normas.norma_de(p.urn), set()).add(p.urn)
    for urn_norma, urns in sorted(por_norma.items()):
        raw = normas.fetch(urn_norma)
        brutos[urn_norma] = store.save(raw, "normas_" + urn_norma.rsplit(":", 1)[1])
        for urn in urns:
            for versao, texto in normas.versoes(raw.body, urn_norma, urn).items():
                dispositivos[(urn, versao)] = texto
    for url in sorted({p.url for p in provas if p.url}):
        raw = http.get(FONTE_SENADO, url, expect_json=False)
        brutos[url] = store.save(raw, "senado_" + url.rsplit("/", 1)[1])
        paginas[url] = normaliza(raw.body.decode("utf-8", errors="replace"))
    return dispositivos, paginas, brutos


def confere_mandatos(
    g: Governos, dispositivos: dict[tuple[str, str], str], paginas: dict[str, str]
) -> list[str]:
    """Motivos de reprovação; lista vazia quando todos os mandatos passam."""
    motivos: list[str] = []
    for i, m in enumerate(g.mandatos):
        trechos = []
        for p in m.provas:
            if p.urn:
                assert p.versao is not None  # garantido por config.Prova
                texto = dispositivos.get((p.urn, p.versao.isoformat()))
                onde = f"{p.urn} (versão {p.versao:%d/%m/%Y})"
            else:
                texto, onde = paginas.get(p.url or ""), p.url
            if texto is None:
                motivos.append(f"{m.slug}: {onde} não encontrado")
            elif normaliza(p.trecho) not in texto:
                motivos.append(f"{m.slug}: trecho não está em {onde}: {p.trecho!r}")
            trechos.append(p.trecho)
        if m.inicio.month == 1 and m.inicio.day == 1:
            if not any("janeiro" in t for t in trechos):
                motivos.append(f"{m.slug}: posse em 1º de janeiro sem prova que fale em janeiro")
        elif not any(f"{m.inicio:%d/%m/%Y}" in t for t in trechos):
            motivos.append(f"{m.slug}: a data {m.inicio:%d/%m/%Y} não aparece em nenhuma prova")
        if i > 0 and g.mandatos[i - 1].inicio >= m.inicio:
            motivos.append(f"{m.slug}: começa antes do mandato anterior")
    return motivos


def confere_fotos(g: Governos, arquivos: dict[str, commons.Arquivo]) -> list[str]:
    """Motivos de reprovação das fotos; lista vazia quando todas conferem com o Commons."""
    motivos: list[str] = []
    for m in g.mandatos:
        a = arquivos.get(m.foto.arquivo)
        if a is None:
            motivos.append(f"{m.slug}: {m.foto.arquivo} não está no Commons")
        elif a.licenca != m.foto.licenca:
            motivos.append(f"{m.slug}: licença no Commons é {a.licenca!r}, não {m.foto.licenca!r}")
        elif m.foto.autor not in a.autor:
            motivos.append(f"{m.slug}: autor no Commons é {a.autor!r}, não {m.foto.autor!r}")
    return motivos


def fins(mandatos: list[Mandato]) -> list[date | None]:
    """Fim de cada mandato: véspera do início do seguinte; o último está em curso."""
    return [b.inicio - timedelta(days=1) for b in mandatos[1:]] + [None]


def grava_mandatos(
    conn: psycopg.Connection,
    g: Governos,
    brutos: dict[str, str],
    hoje: date,
    arquivos: dict[str, commons.Arquivo],
) -> None:
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from mandatos")
        cur.executemany(
            """
            insert into mandatos (slug, ordem, presidente, rotulo, inicio, fim, nota, provas,
                                  foto, conferido_em, raw_objects)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (m.slug, i, m.presidente, m.rotulo, m.inicio, fim, m.nota,
                 Jsonb([p.model_dump(mode="json", exclude_none=True) for p in m.provas]),
                 Jsonb({"url": arquivos[m.foto.arquivo].miniatura,
                        "pagina": arquivos[m.foto.arquivo].pagina,
                        "autor": m.foto.autor, "licenca": m.foto.licenca}),
                 hoje, sorted({brutos[normas.norma_de(p.urn)] if p.urn else brutos[p.url or ""]
                               for p in m.provas} | {brutos["fotos"]}))
                for i, (m, fim) in enumerate(zip(g.mandatos, fins(g.mandatos), strict=True))
            ],
        )  # fmt: skip


def confere_ipca(metas: list[bcb_metas.Meta], ipca_dez: dict[int, Decimal]) -> list[str]:
    """IPCA efetivo da página contra o IPCA de 12 meses de dezembro do banco."""
    motivos = []
    for m in metas:
        if m.ipca_efetivo is None:
            continue
        nosso = ipca_dez.get(m.ano)
        if nosso is None:
            motivos.append(f"meta {m.ano}: o banco não tem o IPCA de dez/{m.ano}")
        elif nosso.quantize(Decimal("0.01")) != m.ipca_efetivo.quantize(Decimal("0.01")):
            motivos.append(f"meta {m.ano}: IPCA na página {m.ipca_efetivo}, no banco {nosso}")
    return motivos


def ipca_dezembro(conn: psycopg.Connection) -> dict[int, Decimal]:
    return {
        ref.year: valor
        for ref, (valor, _rev) in db.current_values(conn, SERIE_IPCA_12M).items()
        if ref.month == 12
    }


def metas_da_aba(metas: list[bcb_metas.Meta], g: config.Governos) -> list[bcb_metas.Meta]:
    """Só os anos a partir do primeiro mandato da aba: o banco não guarda meta de ano sem
    mandato exibido (D27, 08/11/2026). O leitor continua exigindo a tabela inteira, desde
    1999, para recusar a página se ela mudar."""
    primeiro = g.mandatos[0].inicio.year
    return [m for m in metas if m.ano >= primeiro]


def marca_impostos(normas_: list[senado_legislacao.Norma], g: Governos) -> list[bool]:
    padrao = re.compile(g.normas.impostos, re.IGNORECASE)
    return [bool(padrao.search(n.ementa)) for n in normas_]


def grava_normas(
    conn: psycopg.Connection, g: Governos, normas_: list[senado_legislacao.Norma], brutos: list[str]
) -> None:
    impostos = marca_impostos(normas_, g)
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from normas_federais")
        cur.executemany(
            """
            insert into normas_federais (source_id, tipo, numero, data, nome, ementa, url,
                                         impostos, raw_objects)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (senado_legislacao.SOURCE_ID, n.tipo, n.numero, n.data, n.nome, n.ementa, n.url,
                 imp, brutos)
                for n, imp in zip(normas_, impostos, strict=True)
            ],
        )  # fmt: skip


TSE_CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"


def eleito_presidente(ano: int, sq: str) -> bool:
    url = f"{TSE_CDN}/consulta_cand/consulta_cand_{ano}.zip"
    raw = tse.fetch_member(url, f"consulta_cand_{ano}_BRASIL.csv")
    return any(
        c.sq_candidato == sq and c.situacao.upper() == "ELEITO"
        for c in tse.parse_candidatos(raw.body, {"PRESIDENTE"})
    )


def hash_gravado(conn: psycopg.Connection, slug: str) -> str | None:
    row = conn.execute("select hash from planos where mandato = %s", (slug,)).fetchone()
    return row[0] if row else None


def grava_plano(
    conn: psycopg.Connection,
    m: Mandato,
    arquivo: str,
    paginas: int,
    h: str,
    trechos: list[localizar_promessas.Trecho],
    resultado: nucleo.Resultado,
    raw_object: str,
    hoje: date,
) -> None:
    assert m.plano is not None
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from planos_trechos where mandato = %s", (m.slug,))
        cur.execute("delete from planos where mandato = %s", (m.slug,))
        cur.execute(
            """
            insert into planos (mandato, ano, sq_candidato, arquivo, url_pacote, paginas, hash,
                                versao_prompt, modelo, custo_usd, conferido_em, raw_object)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (m.slug, m.plano.ano, m.plano.sq_candidato, arquivo,
             f"{TSE_CDN}/proposta_governo/proposta_governo_{m.plano.ano}_BR.zip", paginas, h,
             localizar_promessas.VERSAO_PROMPT, nucleo.MODELO,
             round(nucleo.custo(resultado.uso), 4), hoje, raw_object),
        )  # fmt: skip
        cur.executemany(
            "insert into planos_trechos (mandato, ordem, pagina, trecho, indicador)"
            " values (%s, %s, %s, %s, %s)",
            [(m.slug, i, t.pagina, t.trecho, t.indicador) for i, t in enumerate(trechos)],
        )


def atualiza_planos(
    conn: psycopg.Connection, g: Governos, store: RawStore, hoje: date
) -> list[str]:
    """Erros por mandato; cada plano é independente (um que falha não apaga os outros)."""
    erros: list[str] = []
    indicadores = {i.id: i.titulo for i in g.indicadores}
    for m in g.mandatos:
        if m.plano is None:
            continue
        ano, sq = m.plano.ano, m.plano.sq_candidato
        arquivo = f"BR/{ano}BR{sq}.pdf"
        try:
            pacote = f"{TSE_CDN}/proposta_governo/proposta_governo_{ano}_BR.zip"
            raw = tse.fetch_member(pacote, arquivo)
            pdf = gzip.decompress(raw.body)
            h = localizar_promessas.hash_de(pdf, indicadores)
            if hash_gravado(conn, m.slug) == h:
                continue
            if not os.environ.get("ANTHROPIC_API_KEY"):
                # sem chave, o plano já gravado continua no site e a leitura nova espera
                log.warning(
                    "plano %s mudou, mas não há ANTHROPIC_API_KEY; fica para depois", m.slug
                )
                continue
            if not eleito_presidente(ano, sq):
                raise ValidationError(f"{sq} não é o eleito para presidente em {ano} (TSE)")
            trechos, r = localizar_promessas.localiza(
                pdf,
                f"Plano registrado no TSE pela candidatura eleita para presidente em {ano}",
                indicadores,
            )
            if trechos is None:
                raise ValidationError("; ".join(r.problemas[:5]) or "agente recusou")
            paginas = len(localizar_promessas.paginas_do_pdf(pdf))
            grava_plano(conn, m, arquivo, paginas, h, trechos, r,
                        store.save(replace(raw, source_id="tse_planos_governo"), f"tse_plano_{ano}_{sq}"), hoje)  # fmt: skip
            log.info("plano %s: %d trechos", m.slug, len(trechos))
        except Exception as exc:  # os trechos anteriores continuam no banco
            log.exception("plano %s falhou", m.slug)
            erros.append(f"plano {m.slug}: {exc}")
    return erros


def grava_metas(
    conn: psycopg.Connection, metas: list[bcb_metas.Meta], raw: RawResponse, raw_object: str
) -> None:
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from metas_inflacao")
        cur.executemany(
            """
            insert into metas_inflacao (source_id, ano, continua, meta, tolerancia, inferior,
                                        superior, normas, meta_original, meta_ajustada, nota,
                                        ipca_efetivo, carta_aberta, carta_url, coletado_em,
                                        raw_object)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (bcb_metas.SOURCE_ID, m.ano, m.continua, m.meta, m.tolerancia, m.inferior,
                 m.superior, list(m.normas), m.meta_original, m.meta_ajustada, m.nota,
                 m.ipca_efetivo, m.carta_aberta, m.carta_url, raw.fetched_at, raw_object)
                for m in metas
            ],
        )  # fmt: skip


def run(
    conn: psycopg.Connection,
    store: RawStore,
    registry: Registry,
    hoje: date | None = None,
) -> Report:
    hoje = hoje or datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    report = Report()
    g = config.load_governos(registry=registry)
    with conn.transaction():
        db.sync_registry(conn, registry)

    try:
        dispositivos, paginas, brutos = baixa_textos(g, store)
        raw_fotos = commons.fetch([m.foto.arquivo for m in g.mandatos])
        arquivos = commons.parse(raw_fotos.body)
        brutos["fotos"] = store.save(raw_fotos, "commons_retratos")
        if motivos := confere_mandatos(g, dispositivos, paginas) + confere_fotos(g, arquivos):
            raise ValidationError("; ".join(motivos))
        grava_mandatos(conn, g, brutos, hoje, arquivos)
    except Exception as exc:  # a lista anterior continua no banco
        log.exception("mandatos: conferência falhou")
        report.errors.append(f"mandatos: {exc}")

    try:
        raw = bcb_metas.fetch()
        metas = bcb_metas.parse(raw.body) + bcb_metas.parse_continua(raw.body, hoje.year)
        metas = metas_da_aba(metas, g)
        if motivos := confere_ipca(metas, ipca_dezembro(conn)):
            raise ValidationError("; ".join(motivos))
        grava_metas(conn, metas, raw, store.save(raw, "bcb_historicometas"))
    except Exception as exc:  # as metas anteriores continuam no banco
        log.exception("metas de inflação falharam")
        report.errors.append(f"metas de inflação: {exc}")

    try:
        lidas: list[senado_legislacao.Norma] = []
        brutos_normas: list[str] = []
        for ano in range(g.mandatos[0].inicio.year - 1, hoje.year + 1):
            for tipo in senado_legislacao.TIPOS:
                raw = senado_legislacao.fetch(tipo, ano)
                lidas += senado_legislacao.parse(raw.body, tipo, ano)
                brutos_normas.append(store.save(raw, f"senado_legislacao_{tipo}_{ano}"))
        if motivos := senado_legislacao.confere(lidas):
            raise ValidationError("; ".join(motivos))
        grava_normas(conn, g, lidas, brutos_normas)
    except Exception as exc:  # a lista anterior continua no banco
        log.exception("normas do período falharam")
        report.errors.append(f"normas do período: {exc}")

    report.errors += atualiza_planos(conn, g, store, hoje)

    log.info("governos: %d mandatos conferidos", len(g.mandatos))
    return report
