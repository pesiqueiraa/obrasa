import json
from datetime import date
from decimal import Decimal

import pytest

from pipelines.config import load_regional
from pipelines.jobs.regional import valida_faixa
from pipelines.models import ValidationError
from pipelines.sources.ibge_agregados import UFS, UfSerie, parse_uf


def resposta(ufs=UFS, nivel="N3", valor="7.5", classificacoes=None):
    return json.dumps(
        [
            {
                "id": "4099",
                "resultados": [
                    {
                        "classificacoes": classificacoes or [],
                        "series": [
                            {
                                "localidade": {
                                    "id": str(u),
                                    "nome": f"UF {u}",
                                    "nivel": {"id": nivel},
                                },
                                "serie": {"202602": valor, "202601": "..."},
                            }
                            for u in sorted(ufs)
                        ],
                    }
                ],
            }
        ]
    ).encode()


def test_le_as_27_ufs():
    d = parse_uf(resposta(), 4099, tipo="trimestral")
    assert len(d) == 27
    assert d[35].valores == {date(2026, 4, 1): Decimal("7.5")}
    assert d[35].nome == "UF 35"  # "..." é omitido


def test_falta_uf():
    with pytest.raises(ValidationError, match="faltam"):
        parse_uf(resposta(ufs=UFS - {53}), 4099, tipo="trimestral")


def test_nivel_errado():
    with pytest.raises(ValidationError, match="não é UF"):
        parse_uf(resposta(nivel="N1"), 4099, tipo="trimestral")


def test_classificacao_inesperada():
    cls = [{"id": 2, "categoria": {"6794": "Total"}}]
    with pytest.raises(ValidationError):
        parse_uf(resposta(classificacoes=cls), 4099, tipo="trimestral")
    assert parse_uf(resposta(classificacoes=cls), 4099, classificacao="2[6794]", tipo="trimestral")


def test_faixa():
    m = next(m for m in load_regional().mapas if m.id == "desocupacao-uf")
    with pytest.raises(ValidationError, match="faixa"):
        valida_faixa(m, {35: UfSerie("São Paulo", {date(2026, 4, 1): Decimal("55")})})


def test_planeja_revisoes_por_uf():
    from pipelines.jobs.regional import planeja

    atual = {
        (35, date(2026, 4, 1)): (Decimal("7.5"), 0),
        (33, date(2026, 4, 1)): (Decimal("8.1"), 2),
    }
    novos = {
        (35, date(2026, 4, 1)): Decimal("7.5"),  # igual: nada
        (33, date(2026, 4, 1)): Decimal("8.0"),  # revisado: revisão 3, a linha antiga fica
        (35, date(2026, 7, 1)): Decimal("7.2"),  # período novo: revisão 0
    }
    assert planeja(atual, novos) == [
        (33, date(2026, 4, 1), Decimal("8.0"), 3),
        (35, date(2026, 7, 1), Decimal("7.2"), 0),
    ]
