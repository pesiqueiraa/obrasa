"""Auditor de textos com cliente falso: entrada montada do config e regras da saída."""

import pytest

from pipelines import config
from pipelines.agentes import auditar_textos
from pipelines.agentes.ferramentas import Ferramentas
from pipelines.tests.test_agentes_investigar import Cliente, _texto


@pytest.fixture
def ferr():
    return Ferramentas(conn=None, store=None, registry=config.load())


def _auditoria(**troca):
    base = {
        "onde": "config/templates/ipca_12m.pt.txt",
        "chave": "inflacao",
        "gravidade": "problema",
        "tipo": "linguagem",
        "texto": "Tirar o juízo sobre o resultado.",
        "citacao": "os preços subiram em média {x}%",
    }
    return {"resumo": "Um achado.", "achados": [{**base, **troca}]}


def test_textos_traz_template_e_serie(ferr):
    itens = auditar_textos.textos(ferr.registry)
    assert len(itens) == len(ferr.registry.indicators)
    item = next(i for i in itens if i["template"].endswith("ipca_12m.pt.txt"))
    assert "{mes_ref}" in item["frase"]
    assert item["serie"]["id"] and item["serie"]["codigo_externo"]


def test_achado_com_citacao_da_entrada_e_aceito(ferr, tmp_path):
    slug = next(
        i["indicador"]
        for i in auditar_textos.textos(ferr.registry)
        if i["template"].endswith("ipca_12m.pt.txt")
    )
    cliente = Cliente(_texto(_auditoria(chave=slug)))
    r, arquivo = auditar_textos.audita(ferr, client=cliente, pasta=tmp_path)
    assert r.aceito, r.problemas
    assert "**problema**" in arquivo.read_text()
    assert cliente.pedidos[0]["output_config"]["effort"] == "medium"


@pytest.mark.parametrize(
    ("troca", "esperado"),
    [
        ({"onde": "apps/web/x.ts"}, "arquivo que não foi auditado"),
        ({"chave": "nao-existe"}, "nem série auditada"),
        ({"citacao": "texto que não está em lugar nenhum"}, "citação"),
    ],
)
def test_achado_fora_das_regras_e_recusado(ferr, tmp_path, troca, esperado):
    slug = next(
        i["indicador"]
        for i in auditar_textos.textos(ferr.registry)
        if i["template"].endswith("ipca_12m.pt.txt")
    )
    ruim = _texto(_auditoria(**{"chave": slug, **troca}))
    r, arquivo = auditar_textos.audita(ferr, client=Cliente(ruim, ruim), pasta=tmp_path)
    assert not r.aceito
    assert any(esperado in p for p in r.problemas), r.problemas
    assert "Auditoria recusada" in arquivo.read_text()


def test_sem_achados_e_aceito(ferr, tmp_path):
    r, arquivo = auditar_textos.audita(
        ferr, client=Cliente(_texto({"resumo": "Sem achados.", "achados": []})), pasta=tmp_path
    )
    assert r.aceito and "Nenhum achado." in arquivo.read_text()


def test_casos_de_avaliacao_aplicam_no_head():
    """Cada trecho plantado existe uma vez nos arquivos do repositório."""
    import yaml

    from pipelines.agentes import avaliar_auditor
    from pipelines.agentes.ferramentas import RAIZ

    casos = yaml.safe_load(avaliar_auditor.CASOS.read_text(encoding="utf-8"))["casos"]
    slugs = {i.slug for i in config.load().indicators}
    for caso in casos:
        assert caso.get("limpo") or caso["achado_em"].get("chave", "x") in slugs | {"x"}
        for t in caso["trocas"]:
            texto = (RAIZ / t["arquivo"]).read_text(encoding="utf-8")
            assert texto.count(t["de"]) == 1, (caso["id"], t["de"])
