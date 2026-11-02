"""Job das Eleições 2026: resultados do TSE e malhas do IBGE (config/eleicoes.yaml).

Etapas, nesta ordem; qualquer falha de validação para o job sem gravar nada:
  1. municípios do IBGE e casamento com os códigos do TSE (um para um);
  2. apuração por município (comparecimento, abstenção, válidos, brancos, nulos);
  3. votos por candidato a presidente, conferidos contra os válidos da apuração;
  4. candidaturas, com o número de eleitos de cada cargo conferido contra as vagas;
  5. malhas de municípios e UFs.

Nada é sobrescrito: se os números de um arquivo mudaram desde a última coleta, entra uma
coleta nova; se não mudaram (o TSE regenera os arquivos com frequência), só a data de
verificação é atualizada.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import defaultdict
from dataclasses import astuple
from datetime import UTC, datetime

import psycopg

from pipelines import config, db
from pipelines.config import Registry
from pipelines.jobs.report import Report
from pipelines.models import RawResponse, ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import ibge_localidades, tse

log = logging.getLogger(__name__)

CARGO_PRESIDENTE = "PRESIDENTE"


def content_hash(items) -> str:
    h = hashlib.sha256()
    for it in items:
        h.update(repr(astuple(it)).encode())
        h.update(b"\n")
    return h.hexdigest()


def check_turnos(apuracao: list[tse.Apuracao], e: config.Eleicao) -> None:
    esperado = {(t.turno, t.cd_eleicao_federal, t.data) for t in e.turnos}
    visto = {(a.turno, a.cd_eleicao, a.data_eleicao) for a in apuracao}
    if not visto <= esperado:
        raise ValidationError(
            f"turnos fora do registro em config/eleicoes.yaml: {visto - esperado}"
        )


def check_vagas(candidatos: list[tse.Candidato], vagas: dict[str, int]) -> None:
    eleitos: dict[str, set[str]] = defaultdict(set)
    for c in candidatos:
        if c.situacao.startswith("ELEITO"):
            eleitos[c.cargo].add(c.sq_candidato)
    erros = [
        f"{cargo}: {len(eleitos.get(cargo, ()))} eleitos, {n} vagas"
        for cargo, n in vagas.items()
        if len(eleitos.get(cargo, ())) != n
    ]
    if erros:
        raise ValidationError("eleitos ≠ vagas: " + "; ".join(erros))


def _coleta(
    conn: psycopg.Connection,
    arquivo: str,
    raw: RawResponse,
    raw_object: str,
    sha: str,
    gerado: datetime | None,
) -> int | None:
    """Devolve o id da coleta nova, ou None se os números não mudaram."""
    agora = datetime.now(UTC)
    with conn.cursor() as cur:
        cur.execute(
            "update eleicao_coletas set verificado_em = %s"
            " where arquivo = %s and conteudo_sha256 = %s",
            (agora, arquivo, sha),
        )
        if cur.rowcount:
            return None
        cur.execute(
            """
            insert into eleicao_coletas (arquivo, url, gerado_em, conteudo_sha256, raw_object,
                                         coletado_em, verificado_em)
            values (%s, %s, %s, %s, %s, %s, %s) returning id
            """,
            (arquivo, raw.url, gerado, sha, raw_object, raw.fetched_at, agora),
        )
        row = cur.fetchone()
        assert row is not None
        return row[0]


def _copy(conn: psycopg.Connection, table: str, cols: list[str], rows) -> int:
    n = 0
    with conn.cursor() as cur, cur.copy(f"copy {table} ({', '.join(cols)}) from stdin") as cp:
        for r in rows:
            cp.write_row(r)
            n += 1
    return n


def _summary(arquivo: str, novos: int, iguais: int) -> db.WriteSummary:
    return db.WriteSummary(arquivo, novos, 0, iguais, [])


COLUNAS = {
    "apuracao": (
        "eleicao_apuracao",
        [
            "cd_eleicao", "turno", "data_eleicao", "cargo", "uf", "cd_municipio_tse",
            "nome_municipio_tse", "aptos", "comparecimento", "abstencoes",
            "aptos_secoes_nao_instaladas", "validos", "brancos", "nulos",
        ],
    ),
    "votos_presidente": (
        "eleicao_votos",
        ["turno", "cargo", "uf", "cd_municipio_tse", "nr_candidato", "votos"],
    ),
    "candidatos": (
        "eleicao_candidatos",
        [
            "turno", "cargo", "uf", "sq_candidato", "nr_candidato", "nome_urna",
            "sg_partido", "sg_federacao", "situacao",
        ],
    ),
}  # fmt: skip


def run(conn: psycopg.Connection, store: RawStore, registry: Registry) -> Report:
    e = config.load_eleicao()
    report = Report()
    with conn.transaction():
        db.sync_registry(conn, registry)

    # 1. municípios do IBGE
    raw_mun = ibge_localidades.fetch_municipios()
    store.save(raw_mun, "municipios")
    municipios = ibge_localidades.parse_municipios(raw_mun.body)

    # 2 a 4. arquivos do TSE (cada um lido por partes de dentro do zip)
    raws: dict[str, RawResponse] = {}
    objetos: dict[str, str] = {}
    for chave, arq in e.arquivos.items():
        raws[chave] = tse.fetch_member(arq.zip, arq.membro)
        objetos[chave] = store.save(raws[chave], arq.membro.removesuffix(".csv"))

    apuracao = tse.parse_apuracao(raws["apuracao"].body, CARGO_PRESIDENTE)
    check_turnos(apuracao, e)
    votos = tse.parse_votos(raws["votos_presidente"].body, CARGO_PRESIDENTE)
    tse.check_votos_batem(apuracao, votos)
    candidatos = tse.parse_candidatos(raws["candidatos"].body, set(e.vagas))
    check_vagas(candidatos, e.vagas)

    no_brasil = {a.cd_municipio_tse: (a.uf, a.nome_municipio_tse) for a in apuracao if a.uf != "ZZ"}
    casamento = ibge_localidades.casar_tse(municipios, no_brasil, e.municipios_excecoes)
    if len(casamento) != len(municipios):
        raise ValidationError(
            f"{len(municipios)} municípios no IBGE e {len(casamento)} casados com o TSE"
        )

    itens = {"apuracao": apuracao, "votos_presidente": votos, "candidatos": candidatos}
    por_ibge = {ib: (cd, como) for cd, (ib, como) in casamento.items()}
    with conn.transaction():
        with conn.cursor() as cur:
            cur.executemany(
                """
                insert into municipios (ibge, nome, uf, cd_tse, casamento_tse)
                values (%s, %s, %s, %s, %s)
                on conflict (ibge) do update set nome = excluded.nome, uf = excluded.uf,
                  cd_tse = excluded.cd_tse, casamento_tse = excluded.casamento_tse
                """,
                [(m.ibge, m.nome, m.uf, *por_ibge[m.ibge]) for m in municipios],
            )
        for chave, (tabela, cols) in COLUNAS.items():
            arquivo = e.arquivos[chave].membro  # type: ignore[index]
            lista = itens[chave]
            raw = raws[chave]
            coleta = _coleta(
                conn, arquivo, raw, objetos[chave], content_hash(lista), tse.gerado_em(raw.body)
            )
            if coleta is None:
                report.summaries.append(_summary(arquivo, 0, len(lista)))
                continue
            n = _copy(conn, tabela, ["coleta_id", *cols], ((coleta, *astuple(i)) for i in lista))
            report.summaries.append(_summary(arquivo, n, 0))

    # 5. malhas
    for intrarregiao, malha_id in (("municipio", "br_municipios"), ("UF", "br_ufs")):
        try:
            raw = ibge_localidades.fetch_malha(intrarregiao)
            objeto = store.save(raw, f"malha_{malha_id}")
            topo = ibge_localidades.parse_malha(raw.body)
            sha = hashlib.sha256(raw.body).hexdigest()
            with conn.transaction(), conn.cursor() as cur:
                cur.execute(
                    """
                    insert into malhas (id, conteudo_sha256, url, formato, conteudo, raw_object,
                                        coletado_em)
                    values (%s, %s, %s, 'topojson', %s, %s, %s)
                    on conflict (id, conteudo_sha256) do nothing
                    """,
                    (malha_id, sha, raw.url, json.dumps(topo), objeto, raw.fetched_at),
                )
                report.summaries.append(_summary(malha_id, cur.rowcount, 1 - cur.rowcount))
        except Exception as exc:  # a malha falha sozinha; os resultados já foram gravados
            log.exception("malha %s falhou", malha_id)
            report.errors.append(f"malha {malha_id}: {exc}")

    return report
