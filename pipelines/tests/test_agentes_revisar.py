"""Revisor de mudanças com repositório git temporário e cliente falso."""

import json
import subprocess

import pytest

from pipelines import config
from pipelines.agentes import revisar
from pipelines.agentes.ferramentas import FerramentaRecusada, Ferramentas
from pipelines.tests.test_agentes_investigar import Cliente, _ferramenta, _texto


def _git(raiz, *args):
    subprocess.run(["git", "-C", str(raiz), *args], check=True, capture_output=True)


@pytest.fixture
def repo(tmp_path):
    raiz = tmp_path / "repo"
    (raiz / "config").mkdir(parents=True)
    (raiz / "outros").mkdir()
    (raiz / "config" / "sources.yaml").write_text("nota_metodologia: Série 4513 do SGS.\n")
    (raiz / "outros" / "x.txt").write_text("a\n")
    _git(raiz, "init", "-q")
    _git(raiz, "-c", "user.email=t@t", "-c", "user.name=t", "add", ".")
    _git(raiz, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base")
    (raiz / "config" / "sources.yaml").write_text(
        "nota_metodologia: Série 4513 do SGS, com resultado saudável.\n"
    )
    (raiz / "outros" / "x.txt").write_text("b\n")
    _git(raiz, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "mudanca")
    ferr = Ferramentas(conn=None, store=None, registry=config.load(), raiz=raiz)
    return revisar.Diff(raiz, "HEAD~1", "HEAD", ferr)


def _revisao(**troca):
    base = {
        "veredito": "problema",
        "resumo": "A nota metodológica ganhou um adjetivo valorativo.",
        "comentarios": [
            {
                "arquivo": "config/sources.yaml",
                "linha": 1,
                "gravidade": "problema",
                "regra": "regra_4_linguagem",
                "texto": "Tirar o adjetivo: a nota descreve a série, não avalia o resultado.",
                "citacao": "com resultado saudável",
            }
        ],
    }
    return {**base, **troca}


def test_so_arquivos_que_interessam(repo):
    assert repo.arquivos() == ["config/sources.yaml"]
    assert "saudável" in repo.ver_diff("config/sources.yaml", 0)
    assert "1: nota_metodologia" in repo.ver_arquivo("config/sources.yaml", 0)
    for arquivo in ("outros/x.txt", "--output=/tmp/x", "config/../outros/x.txt"):
        with pytest.raises(FerramentaRecusada):
            repo.ver_diff(arquivo, 0)


def test_revisao_com_citacao_do_diff_e_aceita(repo, tmp_path):
    cliente = Cliente(
        _ferramenta("ver_diff", arquivo="config/sources.yaml", inicio=0), _texto(_revisao())
    )
    r, arquivo = revisar.revisa(repo, client=cliente, pasta=tmp_path / "agentes")
    assert r.aceito, r.problemas
    md = arquivo.read_text()
    assert "## Veredito: `problema`" in md and "`config/sources.yaml:1`" in md
    assert cliente.pedidos[0]["output_config"]["effort"] == "medium"
    assert {t["name"] for t in cliente.pedidos[0]["tools"]} >= {"ver_diff", "descricao_na_fonte"}


@pytest.mark.parametrize(
    ("troca", "esperado"),
    [
        ({"veredito": "ver_comentarios"}, "veredito problema se e só se"),
        ({"veredito": "sem_problemas", "comentarios": []}, None),
        (
            {"comentarios": [{**_revisao()["comentarios"][0], "arquivo": "outros/x.txt"}]},
            "arquivo que não foi alterado",
        ),
    ],
)
def test_regras_do_veredito(repo, tmp_path, troca, esperado):
    saida = _revisao(**troca)
    cliente = Cliente(
        _ferramenta("ver_diff", arquivo="config/sources.yaml", inicio=0),
        _texto(saida),
        _texto(saida),
    )
    r, _ = revisar.revisa(repo, client=cliente, pasta=tmp_path / "agentes")
    if esperado is None:
        assert r.aceito
    else:
        assert not r.aceito and any(esperado in p for p in r.problemas)


def test_sem_arquivo_que_interesse_nao_chama_a_api(repo):
    sem_nada = revisar.Diff(repo.raiz, "HEAD", "HEAD", repo.ferr)
    assert revisar.revisa(sem_nada, client=Cliente()) == (None, None)


def test_schema_exige_campos_e_nada_alem():
    def fecha(schema):
        if schema.get("type") == "object":
            assert schema["additionalProperties"] is False
            assert set(schema["required"]) == set(schema["properties"])
            for sub in schema["properties"].values():
                fecha(sub)
        if schema.get("type") == "array":
            fecha(schema["items"])

    fecha(revisar.SCHEMA)
    json.dumps(revisar.SCHEMA)


def test_casos_de_avaliacao_do_revisor_aplicam_no_head():
    import yaml

    from pipelines.agentes import avaliar_revisor
    from pipelines.agentes.ferramentas import RAIZ

    casos = yaml.safe_load(avaliar_revisor.CASOS.read_text())["casos"]
    assert len({c["id"] for c in casos}) == len(casos) >= 6
    for c in casos:
        assert set(c["esperado"]) <= {"sem_problemas", "ver_comentarios", "problema"}
        assert set(c.get("regras", [])) <= set(revisar.REGRAS), c["id"]
        for t in c["trocas"]:
            texto = (RAIZ / t["arquivo"]).read_text()
            assert texto.count(t["de"]) == 1, (c["id"], t["arquivo"])
