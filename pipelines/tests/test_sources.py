"""Parsers e validação de layout dos coletores, com respostas reais guardadas."""

import json
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from pipelines.jobs.ipca import compare_sources, validate_ipca
from pipelines.models import Observation, ValidationError
from pipelines.sources import bcb_sgs, ibge_agregados

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def test_ibge_parse_skips_missing_values():
    data = ibge_agregados.parse_variables(load("ibge_1737_63_2265_2266.json"), [63, 2265, 2266])
    # dez/1979 vem "..." na variação mensal; o acumulado só existe a partir de dez/1980
    assert data[63][0].ref_date == date(1980, 1, 1)
    assert data[2265][0].ref_date == date(1980, 12, 1)
    assert data[2265][-1] == Observation(date(2026, 9, 1), Decimal("4.58"))
    assert data[2266][-1].value == Decimal("7695.82")


def test_ibge_rejects_missing_variable():
    payload = json.loads(load("ibge_1737_63_2265_2266.json"))
    body = json.dumps([v for v in payload if v["id"] != "2265"]).encode()
    with pytest.raises(ValidationError, match="ausentes"):
        ibge_agregados.parse_variables(body, [63, 2265, 2266])


def test_ibge_rejects_other_location():
    payload = json.loads(load("ibge_1737_63_2265_2266.json"))
    payload[0]["resultados"][0]["series"][0]["localidade"]["id"] = "35"
    with pytest.raises(ValidationError, match="localidade"):
        ibge_agregados.parse_variables(json.dumps(payload).encode(), [63, 2265, 2266])


def test_ibge_rejects_non_numeric():
    payload = json.loads(load("ibge_1737_63_2265_2266.json"))
    payload[0]["resultados"][0]["series"][0]["serie"]["202609"] = "0,82"
    with pytest.raises(ValidationError, match="não numérico"):
        ibge_agregados.parse_variables(json.dumps(payload).encode(), [63, 2265, 2266])


def test_ibge_periods_have_release_date():
    periods = ibge_agregados.parse_periods(load("ibge_1737_periodos.json"))
    last = max(periods)
    assert last == date(2026, 9, 1)
    assert periods[last].date() == date(2026, 10, 9)


def test_ibge_calendar_next_ipca():
    releases = ibge_agregados.parse_calendar(load("ibge_calendario_9256.json"), 9256)
    by_ref = {r.ref_date: r.released_at.date() for r in releases}
    assert by_ref[date(2026, 10, 1)] == date(2026, 11, 12)


def test_bcb_parse():
    obs = bcb_sgs.parse(load("bcb_sgs_13522.json"))
    assert obs[0] == Observation(date(1980, 12, 1), Decimal("99.25"))
    assert obs[-1] == Observation(date(2026, 9, 1), Decimal("4.58"))


def test_bcb_error_payload():
    body = b'{"erro":{"statusCode":400,"detail":"A quantidade maxima de valores deve ser 20"}}'
    with pytest.raises(ValidationError, match="erro"):
        bcb_sgs.parse(body)


def test_bcb_rejects_duplicate_dates():
    body = b'[{"data":"01/01/2026","valor":"0.1"},{"data":"01/01/2026","valor":"0.2"}]'
    with pytest.raises(ValidationError, match="repetida"):
        bcb_sgs.parse(body)


def test_validate_ipca_accepts_real_data():
    ibge = ibge_agregados.parse_variables(load("ibge_1737_63_2265_2266.json"), [63, 2265, 2266])
    assert validate_ipca(ibge[63], ibge[2265], "IBGE") > 500
    bcb_m = bcb_sgs.parse(load("bcb_sgs_433.json"))
    bcb_12 = bcb_sgs.parse(load("bcb_sgs_13522.json"))
    assert validate_ipca(bcb_m, bcb_12, "BCB") > 500


def test_validate_ipca_catches_wrong_published_value():
    ibge = ibge_agregados.parse_variables(load("ibge_1737_63_2265_2266.json"), [63, 2265, 2266])
    tampered = [*ibge[2265][:-1], Observation(date(2026, 9, 1), Decimal("5.58"))]
    with pytest.raises(ValidationError, match="diverge"):
        validate_ipca(ibge[63], tampered, "IBGE")


def test_validate_ipca_catches_gap():
    ibge = ibge_agregados.parse_variables(load("ibge_1737_63_2265_2266.json"), [63, 2265, 2266])
    gapped = [o for o in ibge[63] if o.ref_date != date(2020, 5, 1)]
    with pytest.raises(ValidationError, match="buraco"):
        validate_ipca(gapped, ibge[2265], "IBGE")


def test_bcb_equals_ibge():
    ibge = ibge_agregados.parse_variables(load("ibge_1737_63_2265_2266.json"), [63, 2265, 2266])
    assert compare_sources(ibge[2265], bcb_sgs.parse(load("bcb_sgs_13522.json"))) == []
