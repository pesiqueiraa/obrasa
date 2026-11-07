"""Aba Impostos: arrecadação da Receita, Focus, Câmara e marcos (config/impostos.yaml).

Fixtures com respostas reais de 07/11/2026: trecho do CSV da Receita (dez/2012, jan/2013 e
jun/2023, mês com ponto de milhar), pesquisa Focus de 30/10/2026, lista e detalhe da Câmara.
"""

import json
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from pipelines import config
from pipelines.models import ValidationError
from pipelines.sources import bcb_focus, camara, receita

FIXTURES = Path(__file__).parent / "fixtures"
CSV = (FIXTURES / "receita_arrecadacao_trecho.csv").read_bytes()


@pytest.fixture
def cfg() -> config.Arrecadacao:
    return config.load_impostos().arrecadacao


def linhas(mes: str) -> list[list[str]]:
    texto = CSV.decode("latin-1").splitlines()
    return [ln.split(";") for ln in texto if ln.startswith(mes)]


def test_numeros_nos_tres_formatos():
    assert receita.numero("231", "") == Decimal(231)
    assert receita.numero("-7544,36", "") == Decimal("-7544.36")
    assert receita.numero("511245,608", "") == Decimal("511245.608")
    assert receita.numero("1.753.289.168", "") == Decimal(1753289168)
    assert receita.numero("226.708.856,85", "") == Decimal("226708856.85")
    assert receita.numero("", "") == Decimal(0)


@pytest.mark.parametrize("texto", ["47,953,915", "1.5", "12a", "1,2,3"])
def test_numero_em_formato_desconhecido_falha(texto):
    with pytest.raises(ValidationError, match="formato desconhecido"):
        receita.numero(texto, "teste")


def test_arrecadacao_comeca_em_desde_e_soma_as_27_ufs(cfg):
    dados = receita.parse(CSV, cfg)
    assert [o.ref_date for o in dados["total"]] == [date(2013, 1, 1), date(2023, 6, 1)]
    cab = CSV.decode("latin-1").splitlines()[0].split(";")
    cols = [cab.index(c) for c in cfg.grupos["previdencia"].colunas if c in cab]
    # jun/2023 traz ponto de milhar na receita previdenciária de algumas UFs
    esperado = sum(
        Decimal(ln[c].replace(".", "").replace(",", ".") or 0)
        for ln in linhas("2023;Junho;")
        for c in cols
    )
    prev = {o.ref_date: o.value for o in dados["previdencia"]}
    assert prev[date(2023, 6, 1)] == esperado / receita.MILHAO
    total = {o.ref_date: o.value for o in dados["total"]}
    grupos = sum(
        {o.ref_date: o.value for o in obs}[date(2023, 6, 1)]
        for g, obs in dados.items()
        if g != "total"
    )
    assert total[date(2023, 6, 1)] == grupos


def test_coluna_sem_grupo_falha(cfg):
    corpo = CSV.replace("IRPF;".encode("latin-1"), "IRPF NOVO;".encode("latin-1"), 1)
    with pytest.raises(ValidationError, match="coluna nova sem grupo"):
        receita.parse(corpo, cfg)


def test_mes_sem_todas_as_ufs_falha(cfg):
    texto = CSV.decode("latin-1").splitlines()
    corpo = "\r\n".join(ln for ln in texto if not ln.startswith("2013;Janeiro;SP")).encode(
        "latin-1"
    )
    with pytest.raises(ValidationError, match="27 UFs"):
        receita.parse(corpo, cfg)


def test_total_e_partes_juntos_falha(cfg):
    texto = CSV.decode("latin-1").splitlines()
    cab = texto[0].split(";")
    i = cab.index("COFINS")
    j = cab.index("COFINS - DEMAIS")
    linha = texto[-1].split(";")
    linha[i], linha[j] = "10", "20"
    corpo = "\r\n".join([*texto[:-1], ";".join(linha)]).encode("latin-1")
    with pytest.raises(ValidationError, match="COFINS e suas partes"):
        receita.parse(corpo, cfg)


def test_series_da_arrecadacao_batem_com_os_grupos(cfg):
    reg = config.load()
    codigos = {s.codigo_externo for s in reg.series if s.coletor == "arrecadacao"}
    assert codigos == {"total", *cfg.grupos}


def test_focus_medianas_da_pesquisa():
    corpo = (FIXTURES / "bcb_focus_20261030.json").read_bytes()
    itens = bcb_focus.parse_pesquisa(corpo, {"IPCA", "Resultado primário"}, date(2026, 10, 30))
    ipca = {e.ano_referencia: e.mediana for e in itens if e.indicador == "IPCA"}
    assert ipca[2026] == Decimal("5.2166")
    primario = {e.ano_referencia: e.mediana for e in itens if e.indicador == "Resultado primário"}
    assert primario[2026] == Decimal("-0.49")  # negativo é déficit (docs/05)


def test_focus_sem_indicador_pedido_falha():
    corpo = (FIXTURES / "bcb_focus_20261030.json").read_bytes()
    with pytest.raises(ValidationError, match="sem"):
        bcb_focus.parse_pesquisa(corpo, {"IPCA", "Indicador inexistente"}, date(2026, 10, 30))


def test_focus_de_outra_data_falha():
    corpo = (FIXTURES / "bcb_focus_20261030.json").read_bytes()
    with pytest.raises(ValidationError, match="outra pesquisa"):
        bcb_focus.parse_pesquisa(corpo, {"IPCA"}, date(2026, 10, 23))


def test_indicadores_com_focus_existem_na_pesquisa():
    corpo = (FIXTURES / "bcb_focus_20261030.json").read_bytes()
    nomes = {i.focus for i in config.load().indicators if i.focus}
    bcb_focus.parse_pesquisa(corpo, nomes, date(2026, 10, 30))


def test_camara_lista_exige_termo_na_ementa():
    corpo = (FIXTURES / "camara_lista_imposto.json").read_bytes()
    todos = json.loads(corpo)["dados"]
    ids, _ = camara.parse_lista(corpo, ["imposto"])
    assert 0 < len(ids) < len(todos)
    por_id = {it["id"]: it["ementa"] for it in todos}
    assert all("imposto" in camara.sem_acento(por_id[i]) for i in ids)


def test_camara_detalhe():
    p = camara.parse_detalhe((FIXTURES / "camara_2483205.json").read_bytes())
    assert (p.sigla_tipo, p.numero, p.ano) == ("PLP", 16, 2025)
    assert p.url.endswith("idProposicao=2483205")
    assert p.situacao


def test_marcos_citam_artigo_e_planalto():
    imp = config.load_impostos()
    assert imp.marcos
    for m in imp.marcos:
        assert "art" in m.lei
        assert m.url.startswith("https://www.planalto.gov.br/")


def test_marco_sem_artigo_falha():
    with pytest.raises(ValueError, match="artigo"):
        config.Marco(
            id="x",
            vigencia=date(2027, 1, 1),
            publico=["pf"],
            titulo="t",
            texto="t",
            lei="Lei nº 1/2000",
            url="https://www.planalto.gov.br/x",
        )
