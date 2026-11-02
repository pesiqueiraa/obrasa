"""Reportes de erro: issue só com a contagem (scripts/reportes.py) e função do banco."""

import os
from datetime import UTC, datetime

import psycopg
import pytest

from pipelines.tests.test_alerta import GhFalso
from scripts import reportes

ONTEM = datetime(2026, 11, 1, tzinfo=UTC)


def test_abre_issue_sem_o_texto_dos_reportes():
    g = GhFalso()
    assert reportes.atualiza(2, ONTEM, run=g) == "aberta"
    criar = next(c for c in g.chamadas if c[:2] == ["issue", "create"])
    assert "**2** reporte(s)" in criar[-1] and "01/11/2026" in criar[-1]


def test_mesma_contagem_nao_mexe_e_zero_fecha():
    texto = reportes.corpo(2, ONTEM)
    g = GhFalso([{"number": 3, "title": reportes.TITULO, "body": texto}])
    assert reportes.atualiza(2, ONTEM, run=g) == "igual"
    assert reportes.atualiza(3, ONTEM, run=g) == "atualizada"
    assert reportes.atualiza(0, None, run=g) == "fechada"
    assert reportes.atualiza(0, None, run=GhFalso()) == "nada"


class Desfaz(Exception):
    pass


@pytest.mark.db
def test_site_so_registra_nao_le():
    with (
        psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn,
        pytest.raises(Desfaz),
        conn.transaction(),
    ):
        conn.execute("set local role anon")
        n = conn.execute(
            "select registra_reporte('', 'O valor de setembro difere do IBGE.', 'https://ibge.gov.br')"
        ).fetchone()[0]
        assert n > 0
        with pytest.raises(psycopg.errors.InsufficientPrivilege), conn.transaction():
            conn.execute("select * from reportes")
        with pytest.raises(psycopg.errors.CheckViolation), conn.transaction():
            conn.execute("select registra_reporte('', 'curto', '')")
        with pytest.raises(psycopg.errors.CheckViolation), conn.transaction():
            conn.execute("select registra_reporte('', 'texto longo o bastante', 'javascript:x')")
        raise Desfaz


@pytest.mark.db
def test_limite_por_hora():
    with (
        psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn,
        pytest.raises(Desfaz),
        conn.transaction(),
    ):
        conn.execute("set local role anon")
        for _ in range(30):
            conn.execute("select registra_reporte('', 'reporte de teste do limite', '')")
        with pytest.raises(psycopg.errors.RaiseException, match="limite"), conn.transaction():
            conn.execute("select registra_reporte('', 'reporte de teste do limite', '')")
        raise Desfaz
