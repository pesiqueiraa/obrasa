"""Valor de referência por série: regras do config e leitura do período certo."""

from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import ValidationError

from pipelines import config, referencia
from pipelines.models import RawResponse
from pipelines.tests.test_series_job import _series

FIXTURES = Path(__file__).parent / "fixtures"


def test_toda_serie_registrada_tem_referencia():
    for s in config.load().series:
        assert s.referencia, s.id
        assert s.referencia.sem_valor_fixo or s.referencia.periodo < date(2025, 1, 1), s.id


@pytest.mark.parametrize(
    "ref",
    [
        None,
        {"periodo": "2019-12-01", "valor": "1.15"},  # falta lido_em
        {"periodo": "2019-12-01", "valor": "1.15", "lido_em": "2026-11-02", "sem_valor_fixo": "x"},
    ],
)
def test_referencia_incompleta_e_recusada(ref):
    with pytest.raises(ValidationError):
        _series(referencia=ref)


def test_le_o_periodo_pedido(monkeypatch):
    corpo = (FIXTURES / "bcb_sgs_433.json").read_bytes()
    monkeypatch.setattr(
        referencia.bcb_sgs,
        "fetch",
        lambda *a: RawResponse("bcb_sgs", "u", corpo, "application/json", datetime.now(UTC)),
    )
    s = _series(id="bcb_sgs_433", codigo_externo="433")
    assert referencia.valor_na_fonte(s, date(1980, 2, 1)) == Decimal("4.62")
    assert referencia.valor_na_fonte(s, date(1970, 1, 1)) is None
