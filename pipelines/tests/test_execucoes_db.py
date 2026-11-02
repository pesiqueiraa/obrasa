"""Registro de execuções (supabase/migrations/20261112000000_execucoes.sql).

Precisa do Postgres com as migrações: `DATABASE_URL=... uv run pytest -m db`. A tabela só
aceita INSERT; os testes usam jobs com nome `teste_*`, que o vigia (/saude) ignora.
"""

import os
from datetime import UTC, datetime

import psycopg
import pytest

from pipelines import db, run
from pipelines.jobs.report import Report

pytestmark = pytest.mark.db


class Desfaz(Exception):
    pass


@pytest.fixture
def coletor():
    with db.connect() as conn:
        yield conn


def test_grava_execucao_e_recusa_alterar(coletor):
    with pytest.raises(Desfaz), coletor.transaction():
        db.grava_execucao(coletor, "teste_db", datetime.now(UTC), ["x: falhou"], ["aviso"], [])
        ok, erros = coletor.execute(
            "select ok, erros from execucoes where job = 'teste_db' order by id desc limit 1"
        ).fetchone()
        assert ok is False and erros == ["x: falhou"]
        with pytest.raises(psycopg.Error), coletor.transaction():
            coletor.execute("update execucoes set ok = true where job = 'teste_db'")
        raise Desfaz


def test_anon_le_horario_mas_nao_o_erro():
    with (
        psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn,
        pytest.raises(Desfaz),
        conn.transaction(),
    ):
        conn.execute("set local role anon")
        conn.execute("select job, terminado_em, ok from execucoes limit 1")
        with pytest.raises(psycopg.errors.InsufficientPrivilege), conn.transaction():
            conn.execute("select erros from execucoes limit 1")
        raise Desfaz


def test_run_registra_execucao_mesmo_com_erro(monkeypatch):
    monkeypatch.setitem(run.JOBS, "teste_run", lambda *a: Report(errors=["fonte: 502"]))
    monkeypatch.setattr(run.raw_store, "from_env", lambda: None)
    antes = datetime.now(UTC)
    assert run.main(["teste_run"]) == 1
    with db.connect() as conn:
        linha = conn.execute(
            "select ok, erros from execucoes where job = 'teste_run' and iniciado_em >= %s",
            (antes,),
        ).fetchone()
    assert linha == (False, ["fonte: 502"])
