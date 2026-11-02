"""O banco recusa alterar dado já gravado (supabase/migrations/20261109000000_integridade.sql).

Precisa do Postgres com as migrações: `DATABASE_URL=... uv run pytest -m db` (o CI roda
num banco limpo). Cada teste grava as próprias linhas numa transação desfeita no fim;
nada fica no banco.
"""

import os
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
import pytest

from pipelines import db

pytestmark = pytest.mark.db

SEMENTE = """
insert into sources (id, nome, orgao) values ('teste_integridade', 'Teste', 'Teste');
insert into series (id, source_id, codigo_externo, nome, unidade, frequencia, tipo)
  values ('teste_integridade_1', 'teste_integridade', '1', 'Teste', '%', 'mensal', 'taxa');
insert into observations (series_id, ref_date, value, revision, collected_at, raw_object)
  values ('teste_integridade_1', '1900-01-01', 1, 0, now(), 'teste');
insert into observacoes_uf (mapa_id, source_id, codigo_externo, uf, uf_nome, ref_date, value,
                            collected_at, raw_object)
  values ('teste', 'teste_integridade', '1/1', 35, 'São Paulo', '1900-01-01', 1, now(), 'teste');
"""


class Desfaz(Exception):
    pass


@contextmanager
def semeado(conn: psycopg.Connection) -> Iterator[None]:
    """Transação com uma linha de teste em observations e observacoes_uf, desfeita no fim."""
    try:
        with conn.transaction():
            conn.execute(SEMENTE)
            yield
            raise Desfaz
    except Desfaz:
        pass


def erro_de(conn: psycopg.Connection, sql: str) -> psycopg.Error | None:
    """Roda `sql` num savepoint e devolve o erro do banco, se houver."""
    try:
        with conn.transaction():
            conn.execute(sql)
            raise Desfaz
    except Desfaz:
        return None
    except psycopg.Error as exc:
        return exc


@pytest.fixture(scope="module")
def coletor():
    with db.connect() as conn:
        yield conn


@pytest.fixture(scope="module")
def admin():
    # Credenciais do postgres sem `set role`: como alguém rodando SQL no painel.
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn:
        yield conn


def test_pipeline_roda_como_coletor(coletor):
    assert coletor.execute("select current_user").fetchone()[0] == "coletor"


@pytest.mark.parametrize("tabela", ["observations", "observacoes_uf"])
@pytest.mark.parametrize("sql", ["update {t} set value = value + 1", "delete from {t}"])
@pytest.mark.parametrize("quem", ["admin", "coletor"])
def test_ninguem_altera_dado_gravado(request, quem, tabela, sql):
    conn = request.getfixturevalue(quem)
    with semeado(conn):
        erro = erro_de(conn, sql.format(t=tabela) + " where ref_date = '1900-01-01'")
    assert erro is not None and erro.sqlstate == "42501"


@pytest.mark.parametrize(
    "tabela",
    ["observations", "observacoes_uf", "eleicao_apuracao", "eleicao_votos", "eleicao_candidatos"],
)
def test_truncate_recusado_e_trigger_presente(admin, tabela):
    erro = erro_de(admin, f"truncate {tabela} cascade")
    assert erro is not None and erro.sqlstate == "42501"
    gatilhos = admin.execute(
        "select tgname from pg_trigger where tgrelid = %s::regclass and not tgisinternal",
        (tabela,),
    ).fetchall()
    assert {"so_insert", "so_insert_truncate"} <= {g[0] for g in gatilhos}


def test_coletor_nao_muda_o_schema(coletor):
    assert erro_de(coletor, "alter table observations add column x int") is not None
    assert erro_de(coletor, "alter table observations disable trigger so_insert") is not None
    assert erro_de(coletor, "drop trigger so_insert on observations") is not None
    assert erro_de(coletor, "create table intrusa (x int)") is not None


def test_coletor_grava_revisao_nova(coletor):
    with semeado(coletor):
        coletor.execute(
            "insert into observations (series_id, ref_date, value, revision, collected_at,"
            " raw_object) values ('teste_integridade_1', '1900-01-01', 2, 1, now(), 'teste')"
        )
        linhas = coletor.execute(
            "select value, revision from observations where series_id = 'teste_integridade_1'"
            " order by revision"
        ).fetchall()
        atual = coletor.execute(
            "select value from observations_current where series_id = 'teste_integridade_1'"
        ).fetchone()
    assert [(int(v), r) for v, r in linhas] == [(1, 0), (2, 1)]  # a linha antiga continua
    assert int(atual[0]) == 2  # a revisão nova vale


def test_salto_segurado_com_historico_lido_do_banco(coletor):
    """Caminho completo da checagem de salto: o valor vigente vem de observations_current."""
    from datetime import date
    from decimal import Decimal

    from pipelines import saltos
    from pipelines.jobs.report import Report
    from pipelines.models import Observation, ValidationError

    with semeado(coletor):
        for i in range(1, 25):  # 1900-02 a 1902-01, oscilando 0,3 p.p.
            coletor.execute(
                "insert into observations (series_id, ref_date, value, revision, collected_at,"
                " raw_object) values ('teste_integridade_1', %s, %s, 0, now(), 'teste')",
                (date(1900 + i // 12, i % 12 + 1, 1), Decimal("1.3") if i % 2 else Decimal(1)),
            )
        novo = [Observation(date(1902, 2, 1), Decimal("5"))]
        with pytest.raises(ValidationError, match="salto fora do histórico"):
            saltos.confere_serie(coletor, "teste_integridade_1", "taxa", novo, [], Report())
        ok = [Observation(date(1902, 2, 1), Decimal("1.2"))]
        saltos.confere_serie(coletor, "teste_integridade_1", "taxa", ok, [], Report())
