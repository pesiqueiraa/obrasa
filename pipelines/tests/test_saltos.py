"""Checagem de salto (pipelines/saltos.py)."""

from datetime import date
from decimal import Decimal as D

import pytest

from pipelines import saltos
from pipelines.models import Observation, ValidationError
from pipelines.saltos import Liberacao


def mensal(inicio: date, valores):
    out = {}
    y, m = inicio.year, inicio.month
    for v in valores:
        out[date(y, m, 1)] = D(str(v))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


# 24 meses de desemprego oscilando entre 6,0 e 6,6: maior variação 0,3 p.p.
HIST = mensal(date(2024, 1, 1), [6.0, 6.3, 6.0, 6.3, 6.6, 6.3] * 4)
PROX = date(2026, 1, 1)


def test_periodo_novo_dentro_do_historico_passa():
    r = saltos.confere("s", "taxa", HIST, [Observation(PROX, D("6.1"))])
    assert r.conferidos == 1 and not r.sem_historico


def test_numero_plausivel_e_errado_e_segurado():
    # 7,3% está dentro de qualquer faixa plausível, mas sobe 1,0 p.p. de uma vez.
    with pytest.raises(ValidationError, match=r"salto fora do histórico.*6\.3 → 7\.3"):
        saltos.confere("s", "taxa", HIST, [Observation(PROX, D("7.3"))])


def test_liberacao_humana_deixa_passar_so_aquele_valor():
    lib = [Liberacao("s", PROX, D("7.3"))]
    saltos.confere("s", "taxa", HIST, [Observation(PROX, D("7.3"))], lib)
    with pytest.raises(ValidationError):  # outro valor no mesmo período continua preso
        saltos.confere("s", "taxa", HIST, [Observation(PROX, D("7.4"))], lib)
    with pytest.raises(ValidationError):  # liberação de outra série não vale
        saltos.confere("outra", "taxa", HIST, [Observation(PROX, D("7.3"))], lib)


def test_revisao_grande_e_segurada():
    ultimo = max(HIST)
    with pytest.raises(ValidationError, match=r"revisão de 6\.3 para 5\.0"):
        saltos.confere("s", "taxa", HIST, [Observation(ultimo, D("5.0"))])


def test_revisao_pequena_passa():
    ultimo = max(HIST)  # 6,3 depois de 6,6
    saltos.confere("s", "taxa", HIST, [Observation(ultimo, D("6.4"))])


def test_revisao_que_cria_salto_contra_o_mes_anterior_e_segurada():
    ultimo = max(HIST)  # 6,3 → 6,2 é revisão de 0,1, mas fica 0,4 abaixo do 6,6 anterior
    with pytest.raises(ValidationError, match=r"6\.6 → 6\.2"):
        saltos.confere("s", "taxa", HIST, [Observation(ultimo, D("6.2"))])


def test_nivel_usa_variacao_percentual():
    # Índice oscilando 1% ao mês; um salto de 20% é segurado, 0,5% passa.
    hist = mensal(date(2024, 1, 1), [100, 101, 100, 101] * 6)
    saltos.confere("i", "nivel", hist, [Observation(PROX, D("101.5"))])
    with pytest.raises(ValidationError, match="%"):
        saltos.confere("i", "nivel", hist, [Observation(PROX, D("121"))])


def test_historico_curto_nao_e_conferido_e_avisa():
    curto = mensal(date(2025, 1, 1), [6.0, 6.1, 6.2])
    r = saltos.confere("s", "taxa", curto, [Observation(date(2025, 4, 1), D("9.9"))])
    assert r.sem_historico


def test_primeira_carga_nao_tem_com_o_que_comparar():
    r = saltos.confere("s", "taxa", {}, [Observation(PROX, D("6.0"))])
    assert r.sem_historico and r.conferidos == 0


def test_sem_mudanca_nao_confere_nada():
    r = saltos.confere("s", "taxa", HIST, [Observation(d, v) for d, v in HIST.items()])
    assert r.conferidos == 0


def test_janela_de_10_anos_esquece_choques_antigos():
    # Um choque de 5 p.p. há 11 anos não serve mais de desculpa para um salto hoje.
    antigo = mensal(date(2013, 1, 1), [6.0, 11.0] + [6.0, 6.3] * 6)
    recente = mensal(date(2024, 1, 1), [6.0, 6.3] * 12)
    with pytest.raises(ValidationError):
        saltos.confere("s", "taxa", {**antigo, **recente}, [Observation(PROX, D("8.0"))])


def test_liberacao_exige_evidencia_e_serie_registrada():
    from pipelines import config

    reg = config.load()
    base = dict(
        serie="bcb_sgs_1",
        periodo="2026-10-26",
        valor="5.5007",
        conferido_por="x",
        conferido_em="2026-11-02",
        evidencia="https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes",
        motivo="x",
    )
    dados = reg.model_dump()
    config.Registry(**{**dados, "liberacoes": [base]})
    with pytest.raises(ValueError, match="evidência"):
        config.Registry(**{**dados, "liberacoes": [{**base, "evidencia": "olhei"}]})
    with pytest.raises(ValueError, match="não registrada"):
        config.Registry(**{**dados, "liberacoes": [{**base, "serie": "inventada"}]})
