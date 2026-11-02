from datetime import date
from decimal import Decimal

import pytest

from pipelines import config
from pipelines.db import PlannedRow, plan_revisions
from pipelines.models import Observation


def test_registry_loads_and_links():
    registry = config.load()
    ind = {i.slug: i for i in registry.indicators}["ipca-12-meses"]
    assert ind.fonte_primaria.series_id == "ibge_agregados_1737_2265"
    assert ind.fonte_reserva is not None
    assert ind.fonte_reserva.series_id == "bcb_sgs_13522"


def test_new_period_gets_revision_zero():
    rows = plan_revisions({}, [Observation(date(2026, 9, 1), Decimal("4.58"))])
    assert rows == [PlannedRow(date(2026, 9, 1), Decimal("4.58"), 0)]


def test_same_value_is_not_rewritten():
    current = {date(2026, 9, 1): (Decimal("4.580"), 0)}
    assert plan_revisions(current, [Observation(date(2026, 9, 1), Decimal("4.58"))]) == []


def test_revision_creates_new_row():
    current = {date(2026, 9, 1): (Decimal("4.58"), 2)}
    rows = plan_revisions(current, [Observation(date(2026, 9, 1), Decimal("4.60"))])
    assert rows == [PlannedRow(date(2026, 9, 1), Decimal("4.60"), 3)]


def _registro_com(indicador_alterado):
    from pipelines import config

    dados = config.load().model_dump()
    dados["indicators"] = [
        indicador_alterado(dict(i)) if i["slug"] == "ipca-12-meses" else i
        for i in dados["indicators"]
    ]
    return dados


@pytest.mark.parametrize(
    ("campo", "valor", "erro"),
    [
        ("unidade", "p.p.", "unidade do indicador"),
        ("frequencia", "trimestral", "frequencia do indicador"),
        ("tipo_serie", "nivel", "tipo do indicador"),
    ],
)
def test_indicador_precisa_descrever_a_serie_que_mostra(campo, valor, erro):
    from pipelines import config

    with pytest.raises(ValueError, match=erro):
        config.Registry(**_registro_com(lambda i: {**i, campo: valor}))


def test_indicador_monetario_exige_serie_nominal():
    from pipelines import config

    dados = config.load().model_dump()
    alvo = next(i for i in dados["indicators"] if i["serie_nominal"])
    alvo["serie_nominal"] = None
    with pytest.raises(ValueError, match="regra 3"):
        config.Registry(**dados)
