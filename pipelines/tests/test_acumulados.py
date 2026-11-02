"""Acumulado em 12 meses por encadeamento, comparado com o publicado pelo IBGE.

Fixture: resposta real da API de Agregados v3, tabela 1737, variáveis 63, 2265 e
2266, de dez/1979 a set/2026 (coletada em 01/11/2026).
"""

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from pipelines.models import Observation
from pipelines.sources import ibge_agregados
from pipelines.transforms.acumulados import acumulado_12m, acumulado_n_meses, chain, compare

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def ibge():
    body = (FIXTURES / "ibge_1737_63_2265_2266.json").read_bytes()
    return ibge_agregados.parse_variables(body, [63, 2265, 2266])


def obs(year: int, month: int, value: str) -> Observation:
    return Observation(date(year, month, 1), Decimal(value))


def test_chain_is_not_a_sum():
    # 12 meses de 1%: a soma daria 12%; o encadeado dá 12,6825...%
    result = chain([Decimal("1")] * 12)
    assert result.quantize(Decimal("0.0001")) == Decimal("12.6825")
    assert result != Decimal("12")


def test_chain_with_negative_months():
    assert chain([Decimal("10"), Decimal("-10")]) == Decimal("-1")


def test_needs_twelve_consecutive_months():
    monthly = [obs(2025, m, "0.5") for m in range(1, 13)]
    out = acumulado_12m(monthly)
    assert [o.ref_date for o in out] == [date(2025, 12, 1)]


def test_gap_is_never_filled():
    monthly = [obs(2025, m, "0.5") for m in range(1, 13) if m != 6]
    monthly.append(obs(2026, 1, "0.5"))
    assert acumulado_12m(monthly) == []


def test_rejects_non_first_day():
    with pytest.raises(ValueError):
        acumulado_n_meses([Observation(date(2025, 1, 15), Decimal("1"))], 1)


def test_september_2026_matches_ibge(ibge):
    computed = {o.ref_date: o.value for o in acumulado_12m(ibge[63])}
    published = {o.ref_date: o.value for o in ibge[2265]}
    ref = date(2026, 9, 1)
    assert published[ref] == Decimal("4.58")
    assert computed[ref].quantize(Decimal("0.01")) == Decimal("4.58")


def test_whole_history_matches_ibge_published(ibge):
    """Todo mês com acumulado publicado bate com o encadeado, dentro da tolerância."""
    compared, divergences = compare(acumulado_12m(ibge[63]), ibge[2265])
    assert compared >= 550
    assert divergences == []


def test_since_2000_rounds_to_published(ibge):
    """Desde 2000 a diferença é só de arredondamento (≤ 0,01 p.p.)."""
    compared, divergences = compare(
        [o for o in acumulado_12m(ibge[63]) if o.ref_date >= date(2000, 1, 1)],
        ibge[2265],
        abs_tol=Decimal("0.01"),
        rel_tol=Decimal("0"),
    )
    assert compared > 300
    assert divergences == []


def test_sum_would_fail_the_check(ibge):
    """Garantia de que o teste pega o erro clássico: somar em vez de encadear."""
    monthly = ibge[63]
    summed = [
        Observation(
            monthly[i].ref_date, sum((o.value for o in monthly[i - 11 : i + 1]), Decimal(0))
        )
        for i in range(11, len(monthly))
    ]
    _, divergences = compare(summed, ibge[2265])
    assert len(divergences) > 400


def test_index_ratio_matches_published(ibge):
    """O número-índice (2266) dá o mesmo acumulado: I_t / I_{t-12} − 1."""
    index = {o.ref_date: o.value for o in ibge[2266]}
    published = {o.ref_date: o.value for o in ibge[2265] if o.ref_date >= date(2000, 1, 1)}
    for ref, value in published.items():
        base = date(ref.year - 1, ref.month, 1)
        ratio = (index[ref] / index[base] - 1) * 100
        assert abs(ratio - value) <= Decimal("0.01"), ref
