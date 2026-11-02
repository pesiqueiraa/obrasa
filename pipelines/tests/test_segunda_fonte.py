"""Segunda fonte: IBGE × cópia do Banco Central (pipelines/segunda_fonte.py)."""

from datetime import date
from decimal import Decimal as D

import pytest

from pipelines import segunda_fonte
from pipelines.models import Observation, ValidationError

TRI = [date(2025, 1, 1), date(2025, 4, 1), date(2025, 7, 1), date(2025, 10, 1)]


def test_igual_passa_e_diferenca_minima_para():
    copia = {date(2026, 9, 1): D("5.2"), date(2026, 8, 1): D("5.3")}
    novas = [Observation(date(2026, 9, 1), D("5.2")), Observation(date(2026, 8, 1), D("5.3"))]
    assert segunda_fonte.confere("s", "c", "igual", D(0), None, novas, copia) == 2
    errado = [Observation(date(2026, 9, 1), D("6.2"))]
    with pytest.raises(ValidationError, match="discorda de c em 1 de 1"):
        segunda_fonte.confere("s", "c", "igual", D(0), None, errado, copia)


def test_periodo_que_a_copia_ainda_nao_tem_fica_para_a_proxima_coleta():
    copia = {date(2026, 8, 1): D("5.3")}
    novas = [Observation(date(2026, 8, 1), D("5.3")), Observation(date(2026, 9, 1), D("9.9"))]
    assert segunda_fonte.confere("s", "c", "igual", D(0), None, novas, copia) == 1


def test_sem_copia_ou_sem_periodo_em_comum_para():
    novas = [Observation(date(2026, 9, 1), D("5.2"))]
    with pytest.raises(ValidationError, match="vazia"):
        segunda_fonte.confere("s", "c", "igual", D(0), None, novas, {})
    with pytest.raises(ValidationError, match="nenhum período em comum"):
        segunda_fonte.confere("s", "c", "igual", D(0), None, novas, {date(2020, 1, 1): D(1)})


def test_variacao_trimestral_do_indice():
    ref = segunda_fonte.derivada(
        "variacao_trimestral", dict(zip(TRI, [D(100), D(101), D(100), D(102)], strict=True))
    )
    assert ref[TRI[1]] == D(1)
    assert round(ref[TRI[2]], 4) == D("-0.9901")
    novas = [Observation(TRI[3], D("2.0"))]
    copia = dict(zip(TRI, [D(100), D(101), D(100), D(102)], strict=True))
    segunda_fonte.confere("s", "c", "variacao_trimestral", D("0.06"), None, novas, copia)
    with pytest.raises(ValidationError):
        segunda_fonte.confere(
            "s", "c", "variacao_trimestral", D("0.06"), None, [Observation(TRI[3], D("2.1"))], copia
        )


def test_acumulado_4_trimestres_do_indice():
    ks = [date(2024 + i // 4, 1 + 3 * (i % 4), 1) for i in range(8)]
    copia = dict(
        zip(ks, [D(100)] * 4 + [D(102)] * 4, strict=True)
    )  # 4 tri 2% acima dos 4 anteriores
    ref = segunda_fonte.derivada("acumulado_4_trimestres", copia)
    assert list(ref) == [ks[7]] and ref[ks[7]] == D(2)


def test_desde_limita_aos_ultimos_anos():
    copia = {date(1997, 1, 1): D("3.85"), date(2026, 4, 1): D("2.1")}
    novas = [Observation(date(1997, 1, 1), D("3.2")), Observation(date(2026, 4, 1), D("2.1"))]
    with pytest.raises(ValidationError):
        segunda_fonte.confere("s", "c", "igual", D("0.06"), None, novas, copia)
    assert segunda_fonte.confere("s", "c", "igual", D("0.06"), date(2016, 11, 1), novas, copia) == 1
