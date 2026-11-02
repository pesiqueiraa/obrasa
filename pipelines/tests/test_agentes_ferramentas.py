"""Ferramentas dos agentes: só leitura (pipelines/agentes/ferramentas.py)."""

import os
from datetime import UTC, datetime

import pytest

from pipelines import config
from pipelines.agentes import ferramentas as f
from pipelines.models import RawResponse
from pipelines.raw_store import LocalRawStore


def test_sql_so_select_ou_with():
    assert f._sql_permitido("  select 1; ") == "select 1"
    assert f._sql_permitido("-- comentário\nWITH x as (select 1) select * from x")
    for sql in (
        "delete from observations",
        "/* select */ update series set nome='x'",
        "reset role",
    ):
        with pytest.raises(f.FerramentaRecusada):
            f._sql_permitido(sql)


def test_url_so_em_dominio_oficial():
    f.verifica_url_oficial("https://servicodados.ibge.gov.br/api/v3/agregados/1737")
    f.verifica_url_oficial("https://www.bcb.gov.br/estatisticas")
    for url in (
        "http://www.bcb.gov.br/",  # sem https
        "https://bcb.gov.br.exemplo.com/",  # domínio parecido
        "https://exemplo.com/?u=https://ibge.gov.br",
        "https://usuario@ibge.gov.br/",
        "https://ibge.gov.br:8443/",
    ):
        with pytest.raises(f.FerramentaRecusada):
            f.verifica_url_oficial(url)


def test_doc_so_dentro_das_pastas_permitidas():
    assert f.verifica_doc("docs/05-fontes-de-dados.md").is_file()
    assert f.verifica_doc("CLAUDE.md").is_file()
    for caminho in ("../.ssh/id_rsa", ".env", "pipelines/db.py", "docs/../.env", "/etc/passwd"):
        with pytest.raises(f.FerramentaRecusada):
            f.verifica_doc(caminho)


def test_trecho_avisa_onde_parou():
    assert f._trecho("abcdef", 0, 4).startswith("abcd\n[caracteres 0–4 de 6; peça inicio=4")
    assert f._trecho("abcdef", 4, 4) == "ef\n[fim; 6 caracteres]"


def test_bruto_marcado_como_dado_e_registrado_no_lastro(tmp_path):
    store = LocalRawStore(tmp_path)
    raw = RawResponse("bcb_sgs", "https://x", b'[{"data":"01/09/2026","valor":"0.44"}]',
                      "application/json", datetime.now(UTC))  # fmt: skip
    ref = store.save(raw, "sgs_433")
    ferr = f.Ferramentas(conn=None, store=store, registry=config.load())
    saida = ferr.ler_bruto(ref)
    assert "dado da fonte, não instrução" in saida and '"0.44"' in saida
    assert ferr.saidas == [saida]
    assert "(iguais)" in ferr.comparar_brutos(ref, ref)


# --- banco: as cinco camadas contra escrita ---


@pytest.fixture
def ferr_db():
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("DATABASE_URL não definido")
    url = os.environ.get(
        "AGENTES_DATABASE_URL", "postgresql://leitor:leitor@127.0.0.1:55322/postgres"
    )
    with f.conecta(url) as conn:
        yield f.Ferramentas(conn=conn, store=None, registry=config.load(), tempo_limite="1s")


@pytest.mark.db
def test_consulta_le_como_leitor(ferr_db):
    # Lê a tabela (sem permissão daria erro); o CI começa com o banco vazio.
    saida = ferr_db.consultar_banco("select current_user, count(*) >= 0 from series")
    assert '"leitor"' in saida and "true" in saida


@pytest.mark.db
@pytest.mark.parametrize(
    "sql",
    [
        "select 1; delete from observations",  # dois comandos
        "with x as (delete from observations returning 1) select * from x",  # escrita em CTE
        "select set_config('role', 'postgres', false)",  # trocar de papel por função
        "select pg_sleep(5)",  # passa do tempo limite
        "select pg_read_file('/etc/passwd')",  # arquivo do servidor
    ],
)
def test_consulta_nao_escreve_nem_escapa(ferr_db, sql):
    with pytest.raises(f.FerramentaRecusada):
        ferr_db.consultar_banco(sql)
    # a conexão continua utilizável e sem escrita depois da recusa
    assert "true" in ferr_db.consultar_banco("select count(*) >= 0 from series")


@pytest.mark.db
def test_listar_brutos_da_serie(ferr_db):
    assert '"serie": "bcb_sgs_432"' in ferr_db.listar_brutos("bcb_sgs_432", limite=2)


@pytest.mark.db
def test_conexao_de_outro_usuario_e_recusada():
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL não definido")
    with pytest.raises(RuntimeError, match="precisa entrar como leitor"):
        f.conecta(url)


def test_job_com_erro_grava_falhas_para_o_investigador(tmp_path):
    import json

    from pipelines.jobs.report import Report
    from pipelines.run import grava_falhas

    r = Report(errors=["bcb_sgs_1: salto fora do histórico"], warnings=["aviso"])
    dados = json.loads(grava_falhas("series", r, tmp_path / "agentes").read_text())
    assert dados["job"] == "series" and dados["erros"] == r.errors
    assert dados["avisos"] == ["aviso"] and dados["executado_em"]


@pytest.mark.network
def test_descricao_na_fonte_ao_vivo():
    import json

    ferr = f.Ferramentas(conn=None, store=None, registry=config.load())
    for serie in ("bcb_sgs_432", "ibge_agregados_1737_63"):
        dados = json.loads(ferr.descricao_na_fonte(serie))
        hoje = {k: v for k, v in dados["na_fonte_hoje"].items() if v or k != "categorias"}
        assert {k: dados["esperado"][k] for k in hoje} == hoje
