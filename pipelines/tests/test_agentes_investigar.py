"""Investigador de falhas com cliente falso: as verificações valem sem gastar API."""

import json
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace as NS

import anthropic
import pytest

from pipelines import config, saltos
from pipelines.agentes import investigar
from pipelines.agentes.ferramentas import Ferramentas
from pipelines.models import Observation, RawResponse, ValidationError
from pipelines.raw_store import LocalRawStore

CORPO = b'[{"data":"26/10/2026","valor":"5.5007"},{"data":"23/10/2026","valor":"5.0371"}]'


def _uso():
    return NS(input_tokens=1000, output_tokens=200, cache_read_input_tokens=0,
              cache_creation_input_tokens=0)  # fmt: skip


def _texto(saida: dict):
    return NS(content=[NS(type="text", text=json.dumps(saida, ensure_ascii=False))],
              stop_reason="end_turn", usage=_uso(), model="claude-opus-5-5")  # fmt: skip


def _ferramenta(nome, **entrada):
    return NS(content=[NS(type="tool_use", id=f"t_{nome}", name=nome, input=entrada)],
              stop_reason="tool_use", usage=_uso(), model="claude-opus-5-5")  # fmt: skip


class Cliente:
    """Devolve as respostas na ordem e guarda o que recebeu."""

    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.pedidos = []
        self.beta = NS(messages=NS(create=self._create))

    def _create(self, **kw):
        self.pedidos.append({**kw, "messages": list(kw["messages"])})  # retrato do pedido
        r = self.respostas.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


@pytest.fixture
def ambiente(tmp_path):
    store = LocalRawStore(tmp_path / "raw")
    raw = RawResponse("bcb_sgs", "https://api.bcb.gov.br/x", CORPO, "application/json",
                      datetime.now(UTC))  # fmt: skip
    ref = store.save(raw, "sgs_1")
    ferr = Ferramentas(conn=None, store=store, registry=config.load())
    falhas = {
        "job": "series",
        "executado_em": "2026-11-02T13:00:00+00:00",
        "erros": [f"bcb_sgs_1: salto fora do histórico; bruto {ref}"],
        "avisos": [],
    }
    return ferr, falhas, ref, tmp_path / "agentes"


def _diagnostico(ref, **troca):
    base = {
        "causa": "salto_real",
        "confianca": "media",
        "resumo": "O dólar (SGS 1) passou de R$ 5,0371 em 23/10/2026 para R$ 5,5007 em 26/10/2026.",
        "evidencias": [
            {
                "ferramenta": "ler_bruto",
                "citacao": '"valor": "5.5007"',
                "o_que_mostra": "a fonte publicou 5.5007 para 26/10/2026",
            }
        ],
        "conferir": [
            {
                "o_que": "cotação PTAX de 26/10/2026",
                "onde": "https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes",
            }
        ],
        "proximo_passo": "Conferir na página do Banco Central e registrar a liberação.",
    }
    return {**base, **troca}


def test_diagnostico_com_lastro_e_aceito(ambiente):
    ferr, falhas, ref, pasta = ambiente
    cliente = Cliente(_ferramenta("ler_bruto", ref=ref, inicio=0), _texto(_diagnostico(ref)))
    r, arquivo = investigar.investiga(falhas, ferr, client=cliente, pasta=pasta)
    assert r.aceito, r.problemas
    md = arquivo.read_text()
    assert "## Causa: `salto_real`" in md and "R$ 5,5007" in md
    # o resultado da ferramenta voltou ao modelo, marcado como dado
    retorno = cliente.pedidos[1]["messages"][-1]["content"][0]
    assert retorno["is_error"] is False and "não instrução" in retorno["content"]
    # pedido com modelo, fallback e schema
    p = cliente.pedidos[0]
    assert p["model"] == "claude-opus-5-5" and p["fallbacks"] == "default"
    assert p["output_config"]["format"]["schema"]["additionalProperties"] is False
    assert all(t["strict"] for t in p["tools"])
    eventos = [json.loads(linha)["evento"] for linha in r.registro.read_text().splitlines()]
    assert eventos == ["inicio", "resposta", "ferramenta", "resposta", "verificacao", "fim"]


def test_numero_inventado_tem_uma_chance_de_correcao(ambiente):
    ferr, falhas, ref, pasta = ambiente
    errado = _diagnostico(ref, resumo="O dólar subiu 9,2% em 26/10/2026.")
    cliente = Cliente(_ferramenta("ler_bruto", ref=ref, inicio=0), _texto(errado),
                      _texto(_diagnostico(ref)))  # fmt: skip
    r, _ = investigar.investiga(falhas, ferr, client=cliente, pasta=pasta)
    assert r.aceito
    pedido_correcao = cliente.pedidos[2]["messages"][-1]["content"]
    assert "9,2" in pedido_correcao and "Não arredonde" in pedido_correcao


def test_numero_inventado_duas_vezes_recusa_sem_mostrar_o_texto(ambiente):
    ferr, falhas, ref, pasta = ambiente
    errado = _diagnostico(ref, resumo="O dólar subiu 9,2% em 26/10/2026.")
    cliente = Cliente(_ferramenta("ler_bruto", ref=ref, inicio=0), _texto(errado), _texto(errado))
    r, arquivo = investigar.investiga(falhas, ferr, client=cliente, pasta=pasta)
    md = arquivo.read_text()
    assert not r.aceito and "## Diagnóstico recusado" in md
    assert "subiu" not in md and "número sem lastro: '9,2'" in md


def test_citacao_que_nao_existe_e_recusada(ambiente):
    ferr, falhas, ref, pasta = ambiente
    inventada = _diagnostico(ref)
    inventada["evidencias"][0]["citacao"] = '"valor": "5.5007", "revisado": true'
    cliente = Cliente(_ferramenta("ler_bruto", ref=ref, inicio=0), _texto(inventada),
                      _texto(inventada))  # fmt: skip
    r, _ = investigar.investiga(falhas, ferr, client=cliente, pasta=pasta)
    assert not r.aceito and any("citação" in p for p in r.problemas)


def test_link_fora_de_dominio_oficial_e_recusado(ambiente):
    ferr, falhas, ref, pasta = ambiente
    fora = _diagnostico(ref, conferir=[{"o_que": "cotação", "onde": "https://exemplo.com/dolar"}])
    cliente = Cliente(_ferramenta("ler_bruto", ref=ref, inicio=0), _texto(fora), _texto(fora))
    r, _ = investigar.investiga(falhas, ferr, client=cliente, pasta=pasta)
    assert not r.aceito and any("domínios oficiais" in p for p in r.problemas)


def test_sem_ferramenta_nenhum_numero_tem_lastro(ambiente):
    ferr, falhas, ref, pasta = ambiente
    cliente = Cliente(_texto(_diagnostico(ref)), _texto(_diagnostico(ref)))
    r, _ = investigar.investiga(falhas, ferr, client=cliente, pasta=pasta)
    assert not r.aceito


def test_ferramenta_recusada_volta_como_erro_ao_modelo(ambiente):
    ferr, falhas, ref, pasta = ambiente
    sem_evidencia = _diagnostico(
        ref,
        causa="indeterminado",
        evidencias=[],
        resumo="Sem evidência suficiente.",
        conferir=[{"o_que": "seção do SGS", "onde": "docs/05-fontes-de-dados.md"}],
    )
    cliente = Cliente(_ferramenta("ler_doc", caminho=".env", inicio=0), _texto(sem_evidencia))
    r, _ = investigar.investiga(falhas, ferr, client=cliente, pasta=pasta)
    retorno = cliente.pedidos[1]["messages"][-1]["content"][0]
    assert retorno["is_error"] is True and retorno["content"].startswith("Recusado")
    assert r.aceito  # "indeterminado" sem evidência é permitido


@pytest.mark.parametrize(
    "resposta",
    [
        NS(content=[], stop_reason="refusal", usage=_uso(), model="claude-opus-5-5"),
        anthropic.APIConnectionError(request=None),
    ],
)
def test_recusa_ou_erro_da_api_nao_quebram(ambiente, resposta):
    ferr, falhas, _ref, pasta = ambiente
    r, arquivo = investigar.investiga(falhas, ferr, client=Cliente(resposta), pasta=pasta)
    assert not r.aceito and r.problemas and "recusado" in arquivo.read_text()


def test_rascunho_de_liberacao_sai_do_erro_real_da_checagem():
    hist = {date(2025, m, 1): Decimal("5.0") + Decimal(m) / 100 for m in range(1, 13)}
    hist |= {date(2024, m, 1): Decimal("5.0") for m in range(1, 13)}
    with pytest.raises(ValidationError) as exc:
        saltos.confere("bcb_sgs_1", "nivel", hist, [Observation(date(2026, 1, 1), Decimal("7.1"))])
    rascunho = investigar.rascunho_liberacao([f"bcb_sgs_1: {exc.value}"])
    assert "serie: bcb_sgs_1" in rascunho and "periodo: 2026-01-01" in rascunho
    assert 'valor: "7.1"' in rascunho and "conferido_por:" in rascunho
    assert investigar.rascunho_liberacao(["fonte fora do ar"]) is None


def test_casos_de_avaliacao_sao_validos():
    import yaml

    from pipelines.agentes import avaliar

    casos = yaml.safe_load(avaliar.CASOS.read_text())["casos"]
    assert len({c["id"] for c in casos}) == len(casos) >= 6
    for c in casos:
        assert set(c["esperado"]) <= set(investigar.CAUSAS), c["id"]
        assert c["falhas"]["job"] and c["falhas"]["erros"]
