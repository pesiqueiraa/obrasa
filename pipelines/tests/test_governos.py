"""Aba Governos: metas de inflação do BC e conferência das datas dos mandatos.

Fixture com a resposta real da página de histórico de metas do Banco Central, 08/11/2026.
"""

import dataclasses
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from pipelines import config
from pipelines.jobs import governos
from pipelines.models import ValidationError
from pipelines.sources import bcb_metas, commons, senado_legislacao

FIXTURES = Path(__file__).parent / "fixtures"
METAS = (FIXTURES / "bcb_historicometas.json").read_bytes()

ART82 = "urn:lex:br:federal:constituicao:1988-10-05;1988!art82_cpt"
EC111 = "urn:lex:br:federal:emenda.constitucional:2021-09-28;111!art5_cpt"
DEN = "https://www25.senado.leg.br/web/atividade/materias/-/materia/125567"
TEXTOS = {
    (
        ART82,
        "1994-06-07",
    ): "O mandato do Presidente da República é de quatro anos, vedada a reeleição "
    "para o período subseqüente, e terá início em 1º de janeiro do ano seguinte ao da sua eleição.",
    (ART82, "1997-06-04"): "O mandato do Presidente da República é de quatro anos e terá início em "
    "primeiro de janeiro do ano seguinte ao da sua eleição.",
    (
        EC111,
        "2021-09-28",
    ): "As alterações efetuadas nos arts. 28 e 82 ... serão aplicadas somente a "
    "partir das eleições de 2026.",
}
PAGINAS = {
    DEN: "12/05/2016 Publicado no DSF Páginas 8-171 Aprovado o Parecer nº 475, de 2016, da Comissão "
    "... sessão solene do Congresso Nacional para hoje, 31/08/2016, às 16h, para posse ao "
    "Excelentíssimo Senhor Michel Temer, como Presidente da República. ... Norma Gerada: Resolução "
    "do Senado Federal nº 35 de 31/08/2016"
}


# ---- Metas de inflação (página do BC) ----


def por_ano() -> dict[int, bcb_metas.Meta]:
    return {m.ano: m for m in bcb_metas.parse(METAS)}


def test_tabela_de_1999_a_2024_sem_buraco():
    assert sorted(por_ano()) == list(range(1999, 2025))


def test_valores_de_um_ano_simples():
    m = por_ano()[2015]
    assert (m.meta, m.tolerancia, m.inferior, m.superior) == (
        Decimal("4.5"), Decimal("2.0"), Decimal("2.5"), Decimal("6.5"),
    )  # fmt: skip
    assert m.normas == ("Resolução CMN nº 4.237",)
    assert m.ipca_efetivo == Decimal("10.67")
    assert m.carta_aberta is True
    assert m.carta_url == (
        "https://www.bcb.gov.br/content/controleinflacao/controleinflacao_docs/carta_aberta/carta2015.pdf"
    )
    assert por_ano()[2014].carta_aberta is False and por_ano()[2014].carta_url is None


def test_ano_com_duas_resolucoes_e_meta_ajustada():
    m = por_ano()[2003]
    assert m.meta == Decimal("4") and m.meta_original == Decimal("3.25")
    assert m.normas == ("Resolução CMN nº 2.972", "Resolução CMN nº 2.842")
    assert m.meta_ajustada == Decimal("8.5")
    assert m.nota and "21/1/2003" in m.nota
    assert por_ano()[2004].meta_ajustada == Decimal("5.5")
    assert por_ano()[2005].meta_ajustada is None and por_ano()[2005].nota is None


def test_norma_da_celula_com_rowspan_vale_para_1999_a_2001():
    anos = por_ano()
    assert {anos[a].normas for a in (1999, 2000, 2001)} == {("Resolução CMN nº 2.615",)}
    assert anos[1999].meta == Decimal("8") and anos[2000].meta == Decimal("6")


def test_meta_continua_desde_2025():
    metas = bcb_metas.parse_continua(METAS, 2026)
    assert [m.ano for m in metas] == [2025, 2026]
    assert all(
        m.continua and m.meta == Decimal("3.00") and m.tolerancia == Decimal("1.5") for m in metas
    )
    assert metas[0].normas == ("Resolução CMN nº 5.141",)
    assert metas[0].ipca_efetivo is None and metas[0].carta_aberta is None


def test_intervalo_que_nao_fecha_com_a_meta_e_recusado():
    quebrado = METAS.replace(b"<td>2,5-6,5<br></td>", b"<td>2,5-7,5<br></td>", 1)
    assert quebrado != METAS
    with pytest.raises(ValidationError, match="não é"):
        bcb_metas.parse(quebrado)


def test_cabecalho_diferente_e_recusado():
    with pytest.raises(ValidationError, match="cabeçalho"):
        bcb_metas.parse(METAS.replace(b"Carta Aberta", b"Carta", 1))


def test_ipca_da_pagina_precisa_ser_igual_ao_do_banco():
    metas = bcb_metas.parse(METAS)
    banco = {m.ano: m.ipca_efetivo for m in metas}
    assert governos.confere_ipca(metas, banco) == []
    banco[2015] = Decimal("10.68")
    assert governos.confere_ipca(metas, banco) == [
        "meta 2015: IPCA na página 10.67, no banco 10.68"
    ]
    del banco[2015]
    assert governos.confere_ipca(metas, banco) == ["meta 2015: o banco não tem o IPCA de dez/2015"]


def test_ipca_do_banco_com_mais_casas_arredonda_para_duas():
    metas = [m for m in bcb_metas.parse(METAS) if m.ano == 2024]
    assert governos.confere_ipca(metas, {2024: Decimal("4.8300")}) == []


# ---- Mandatos (config/governos.yaml) ----


@pytest.fixture
def g() -> config.Governos:
    return config.load_governos(registry=config.load())


def test_config_real_passa_com_os_textos_das_fontes(g):
    assert governos.confere_mandatos(g, TEXTOS, PAGINAS) == []


def test_fim_e_a_vespera_do_mandato_seguinte(g):
    fins = dict(zip([m.slug for m in g.mandatos], governos.fins(g.mandatos), strict=True))
    assert fins["lula-1"] == date(2006, 12, 31)
    assert fins["dilma-2"] == date(2016, 5, 11)
    assert fins["temer"] == date(2018, 12, 31)
    assert fins["lula-3"] is None


def test_trecho_que_nao_esta_na_fonte_reprova(g):
    textos = dict(TEXTOS)
    textos[(ART82, "1997-06-04")] = "O mandato terá início em 5 de janeiro do ano seguinte."
    motivos = governos.confere_mandatos(g, textos, PAGINAS)
    assert motivos and all("trecho não está" in m for m in motivos)
    assert {m.split(":")[0] for m in motivos} == {
        "lula-1", "lula-2", "dilma-1", "dilma-2", "bolsonaro", "lula-3",
    }  # fmt: skip


def test_versao_sem_texto_reprova(g):
    textos = {k: v for k, v in TEXTOS.items() if k[0] != EC111}
    assert governos.confere_mandatos(g, textos, PAGINAS) == [
        f"lula-3: {EC111} (versão 28/09/2021) não encontrado"
    ]


def test_data_fora_de_janeiro_precisa_estar_escrita_na_prova(g):
    temer = next(m for m in g.mandatos if m.slug == "temer")
    temer.inicio = date(2016, 5, 13)
    assert governos.confere_mandatos(g, TEXTOS, PAGINAS) == [
        "temer: a data 13/05/2016 não aparece em nenhuma prova"
    ]


def test_pagina_do_senado_mudou_reprova(g):
    paginas = {DEN: PAGINAS[DEN].replace("Parecer nº 475", "Parecer nº 476")}
    assert governos.confere_mandatos(g, TEXTOS, paginas) == [
        f"temer: trecho não está em {DEN}: "
        "'12/05/2016 Publicado no DSF Páginas 8-171 Aprovado o Parecer nº 475, de 2016'"
    ]


def test_normaliza_tira_tags_entidades_e_espacos():
    assert governos.normaliza("<p>Res&eacute;​olu\n  ção</p>") == "Reséolu ção"


def test_prova_exige_urn_ou_url():
    with pytest.raises(ValueError, match="só um dos dois"):
        config.Prova(trecho="x")
    with pytest.raises(ValueError, match="versão"):
        config.Prova(trecho="x", urn=ART82)


def test_indicadores_citam_series_registradas(g):
    assert [i.id for i in g.indicadores][:3] == ["inflacao", "selic", "pib"]


def test_series_cobrem_a_posse_do_primeiro_mandato(g):
    """Só entram mandatos com todos os indicadores antes da posse (D27): a série precisa
    começar antes do primeiro mandato da lista."""
    series = {s.id: s for s in config.load().series}
    primeiro = g.mandatos[0].inicio
    for ind in g.indicadores:
        desde = series[ind.serie].desde
        assert desde is None or desde < primeiro, f"{ind.id}: série começa em {desde}"


def test_metas_so_dos_anos_da_aba(g):
    metas = bcb_metas.parse(METAS)
    anos = [m.ano for m in governos.metas_da_aba(metas, g)]
    assert min(anos) == 2003
    assert 2002 not in anos


FOTOS = commons.parse((FIXTURES / "commons_retratos.json").read_bytes())


def test_fotos_conferem_com_o_commons(g):
    assert governos.confere_fotos(g, FOTOS) == []


def test_foto_com_licenca_diferente_reprova(g):
    arq = g.mandatos[0].foto.arquivo
    outra = {**FOTOS, arq: dataclasses.replace(FOTOS[arq], licenca="CC BY-NC 2.0")}
    assert governos.confere_fotos(g, outra) == [
        f"lula-1: licença no Commons é 'CC BY-NC 2.0', não {g.mandatos[0].foto.licenca!r}"
    ]


def test_foto_ausente_reprova(g):
    arq = g.mandatos[-1].foto.arquivo
    sem = {k: v for k, v in FOTOS.items() if k != arq}
    assert governos.confere_fotos(g, sem) == [f"lula-3: {arq} não está no Commons"]


def test_miniatura_sem_rastreio():
    assert all("?" not in a.miniatura for a in FOTOS.values())


def _legis(tipo: str, ano: int) -> list[senado_legislacao.Norma]:
    body = (FIXTURES / f"senado_legislacao_{tipo.lower()}_{ano}.json").read_bytes()
    return senado_legislacao.parse(body, tipo, ano)


def test_legislacao_le_ementa_e_monta_urn():
    ec132 = next(n for n in _legis("EMC", 2023) if n.numero == 132)
    assert ec132.ementa == "Altera o Sistema Tributário Nacional."
    assert ec132.data == date(2023, 12, 20)
    assert (
        ec132.url
        == "https://normas.leg.br/?urn=urn:lex:br:federal:emenda.constitucional:2023-12-20;132"
    )


def test_legislacao_sem_buraco_passa():
    normas_ = _legis("EMC", 2022) + _legis("EMC", 2023) + _legis("LCP", 2023)
    assert senado_legislacao.confere(normas_) == []


def test_legislacao_com_buraco_reprova():
    normas_ = [n for n in _legis("EMC", 2023) if n.numero != 130] + _legis("LCP", 2023)
    assert senado_legislacao.confere(normas_) == ["EMC: falta entre 129 e 131"]


def test_legislacao_tipo_errado_reprova():
    body = (FIXTURES / "senado_legislacao_lcp_2023.json").read_bytes()
    with pytest.raises(ValidationError):
        senado_legislacao.parse(body, "EMC", 2023)


def test_impostos_pela_ementa(g):
    normas_ = _legis("EMC", 2023)
    marcas = dict(
        zip([n.numero for n in normas_], governos.marca_impostos(normas_, g), strict=True)
    )
    assert marcas[132] is True
    assert marcas[130] is False


# Bloco 3: conferência dos trechos do plano (sem chamar o modelo)

from pipelines.agentes import localizar_promessas as lp  # noqa: E402

PAGINAS_PLANO = [
    "Diagnóstico: em 2013 o país cresceu 2,3%.",
    "Vamos criar 2 milhões de vagas em cre ches até 2018. Outro texto.",
]
IND = {"pib": "PIB"}


def _saida(*trechos):
    return {"trechos": [{"pagina": p, "trecho": t, "indicador": i} for p, t, i in trechos]}


def test_trecho_literal_na_pagina_passa_mesmo_com_espaco_solto():
    saida = _saida((2, "Vamos criar 2 milhões de vagas em creches até 2018.", "nenhum"))
    assert lp.confere(saida, PAGINAS_PLANO, IND) == []


def test_trecho_reescrito_reprova():
    saida = _saida((2, "Criaremos 2 milhões de vagas em creches até 2018.", "nenhum"))
    assert lp.confere(saida, PAGINAS_PLANO, IND)[0].startswith("trecho não está na página 2")


def test_trecho_na_pagina_errada_reprova():
    saida = _saida((1, "Vamos criar 2 milhões de vagas em creches até 2018.", "nenhum"))
    assert lp.confere(saida, PAGINAS_PLANO, IND) == []  # junção com a página seguinte vale
    saida = _saida((2, "Diagnóstico: em 2013 o país cresceu 2,3%.", "pib"))
    assert lp.confere(saida, PAGINAS_PLANO, IND)[0].startswith("trecho não está na página 2")


def test_trecho_sem_algarismo_e_indicador_fora_da_lista_reprovam():
    saida = _saida((2, "Outro texto.", "selic"))
    problemas = lp.confere(saida, PAGINAS_PLANO, IND)
    assert any("sem algarismo" in p for p in problemas)
    assert any("indicador fora da lista" in p for p in problemas)


def test_trecho_repetido_reprova():
    t = (2, "Vamos criar 2 milhões de vagas em creches até 2018.", "nenhum")
    assert any("repetido" in p for p in lp.confere(_saida(t, t), PAGINAS_PLANO, IND))


def test_plano_sem_promessa_com_numero_passa():
    assert lp.confere({"trechos": []}, PAGINAS_PLANO, IND) == []


def test_bloco_recusa_pagina_fora_do_bloco():
    saida = _saida((1, "Diagnóstico: em 2013 o país cresceu 2,3%.", "pib"))
    assert lp.confere_bloco(saida, PAGINAS_PLANO[1:], 2, IND) == ["página 1 fora do bloco 2–2"]


def test_mandato_exige_plano_ou_frase(g):
    for m in g.mandatos:
        assert (m.plano is None) != (m.sem_plano is None)
    assert [m.slug for m in g.mandatos if m.plano] == ["dilma-1", "dilma-2", "bolsonaro", "lula-3"]


def test_trecho_cortado_no_meio_da_frase_reprova():
    saida = _saida((2, "Vamos criar 2 milhões de vagas em creches", "nenhum"))
    assert any("cortado" in p for p in lp.confere(saida, PAGINAS_PLANO, IND))
