"""Testes contra as APIs oficiais. Rodam no job agendado e sob demanda:
`uv run pytest -m network`."""

import pytest

from pipelines import config
from pipelines.jobs.ipca import validate_ipca
from pipelines.referencia import valor_na_fonte
from pipelines.sources import bcb_sgs, ibge_agregados
from pipelines.transforms.acumulados import acumulado_12m, compare

pytestmark = pytest.mark.network


def test_ibge_live_last_24_months_match_chain():
    raw = ibge_agregados.fetch_variables(1737, [63, 2265], "-24")
    data = ibge_agregados.parse_variables(raw.body, [63, 2265])
    compared, divergences = compare(acumulado_12m(data[63]), data[2265])
    assert compared == 13
    assert divergences == []


def test_bcb_live_last_20():
    from datetime import date, timedelta

    today = date.today()
    raw_m = bcb_sgs.fetch(433, today - timedelta(days=800), today)
    raw_12 = bcb_sgs.fetch(13522, today - timedelta(days=800), today)
    assert validate_ipca(bcb_sgs.parse(raw_m.body), bcb_sgs.parse(raw_12.body), "BCB") >= 12


@pytest.mark.parametrize(
    "serie",
    [s for s in config.load().series if s.referencia and not s.referencia.sem_valor_fixo],
    ids=lambda s: s.id,
)
def test_valor_de_referencia_na_fonte(serie):
    """O período antigo de config/sources.yaml ainda tem o mesmo valor na fonte."""
    ref = serie.referencia
    assert valor_na_fonte(serie, ref.periodo) == ref.valor, (
        f"{serie.id}: {ref.periodo} era {ref.valor} em {ref.lido_em}. A fonte revisou um "
        "período fechado ou a série mudou de significado; confira antes de trocar o valor."
    )
