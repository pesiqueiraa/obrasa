"""Conferência da descrição da série na fonte (pipelines/metadados.py), com respostas
reais do webservice SGS e do endpoint de metadados do IBGE (02/11/2026)."""

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from pipelines import config, metadados
from pipelines.config import NaFonte
from pipelines.models import Descricao, Observation, ValidationError
from pipelines.sources import bcb_sgs, ibge_agregados

FIX = Path(__file__).parent / "fixtures"


def test_sgs_descricao_e_ultimo_valor():
    d, ref, valor = bcb_sgs.parse_metadata((FIX / "bcb_sgs_meta_24363.xml").read_bytes(), 24363)
    assert d == Descricao(
        nome="Índice de Atividade Econômica do Banco Central - IBC-Br",
        unidade="Índice",
        periodicidade="M",
    )
    assert (ref, valor) == (date(2026, 8, 1), Decimal("111.71919"))


def test_sgs_recusa_resposta_de_outra_serie():
    with pytest.raises(ValidationError, match="série 24363, não 432"):
        bcb_sgs.parse_metadata((FIX / "bcb_sgs_meta_24363.xml").read_bytes(), 432)


def test_sgs_recusa_resposta_fora_do_formato():
    with pytest.raises(ValidationError):
        bcb_sgs.parse_metadata(b"<html>Requisicao invalida</html>", 432)


def test_ibge_descricao_independe_do_periodo():
    d = ibge_agregados.parse_metadata((FIX / "ibge_1737_metadados.json").read_bytes(), 63)
    assert d == Descricao(nome="IPCA - Variação mensal", unidade="%", periodicidade="mensal")


def test_ibge_nome_das_categorias():
    body = (FIX / "ibge_7126_metadados.json").read_bytes()
    d = ibge_agregados.parse_metadata(body, 3593, "2[6794]|58[108866]")
    assert d.unidade == "Anos"
    assert d.categorias == ("Total", "25 anos ou mais")


def test_ibge_categoria_ou_variavel_inexistente():
    body = (FIX / "ibge_7126_metadados.json").read_bytes()
    with pytest.raises(ValidationError, match="categoria"):
        ibge_agregados.parse_metadata(body, 3593, "58[1]")
    with pytest.raises(ValidationError, match="variável"):
        ibge_agregados.parse_metadata(body, 1, None)


ESPERADO = NaFonte(nome="IPCA - Variação mensal", unidade="%", periodicidade="mensal")


def test_descricao_igual_passa():
    metadados.confere(ESPERADO, Descricao("IPCA - Variação mensal", "%", "mensal"), "x")


@pytest.mark.parametrize(
    "mudou",
    [
        Descricao("IPCA - Variação mensal", "Número-índice", "mensal"),  # unidade
        Descricao("IPCA-15 - Variação mensal", "%", "mensal"),  # outra pesquisa
        Descricao("IPCA - Variação mensal", "%", "trimestral"),  # periodicidade
        Descricao("IPCA - Variação mensal", "%", "mensal", ("Total",)),  # recorte
    ],
)
def test_qualquer_mudanca_na_descricao_para_a_coleta(mudou):
    with pytest.raises(ValidationError, match="a fonte mudou a descrição"):
        metadados.confere(ESPERADO, mudou, "ibge_agregados_1737_63")


OBS = [
    Observation(date(2026, 7, 1), Decimal("114.48992")),
    Observation(date(2026, 8, 1), Decimal("111.71919")),
]


def test_ultimo_valor_bate_com_os_dados():
    metadados.confere_ultimo("bcb_sgs_24363", date(2026, 8, 1), Decimal("111.71919"), OBS)


def test_ultimo_valor_diferente_para_a_coleta():
    with pytest.raises(ValidationError, match="discordam"):
        metadados.confere_ultimo("bcb_sgs_24363", date(2026, 8, 1), Decimal("111.7"), OBS)


def test_ultimo_periodo_que_a_coleta_nao_trouxe():
    with pytest.raises(ValidationError, match="não trouxe"):
        metadados.confere_ultimo("bcb_sgs_24363", date(2026, 9, 1), Decimal("110"), OBS)


def test_toda_serie_do_bcb_e_do_ibge_tem_descricao():
    reg = config.load()
    faltam = [
        s.id for s in reg.series if s.source_id in config.FONTES_COM_DESCRICAO and not s.na_fonte
    ]
    assert faltam == []
    assert all(m.na_fonte for m in config.load_regional(registry=reg).mapas)
