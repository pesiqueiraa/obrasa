"""Conferência automática dos marcos: leitor do normas.leg.br, checagem de números e agente
com cliente falso (sem gastar API). O teste marcado `db` precisa do Postgres local."""

import json
from datetime import UTC, date, datetime

import pytest

from pipelines import config, db
from pipelines.agentes import conferir_marcos
from pipelines.jobs import impostos
from pipelines.jobs.report import Report
from pipelines.models import RawResponse, ValidationError
from pipelines.raw_store import LocalRawStore
from pipelines.sources import normas
from pipelines.tests.test_agentes_investigar import Cliente, _ferramenta, _texto

NORMA = "urn:lex:br:federal:lei:2025-11-26;15270"


def _no(disp: str, *versoes: tuple[str, str], rotulo: str = "", filhos=()):
    exemplos = [
        {"legislationIdentifier": f"{NORMA}@{d}!{disp}", "legislationDate": d, "text": t,
         "name": rotulo}
        for d, t in versoes
    ]  # fmt: skip
    return {
        "legislationIdentifier": f"{NORMA}!{disp}",
        "workExample": exemplos[0] if len(exemplos) == 1 else exemplos,
        "hasPart": list(filhos),
    }


CORPO = json.dumps(
    {
        "legislationIdentifier": NORMA,
        "hasPart": [
            _no(
                "art6-1_cpt",
                (
                    "2025-11-26",
                    "A partir de 2026, retenção de <b>10%</b> acima de R$ 50.000,00 (cinquenta mil reais).",
                ),
                rotulo="Art. 6º-A.",
                filhos=[
                    _no(
                        "art6-1_par3_inc2",
                        ("2025-11-26", "aprovada até 31 de dezembro de 2025;"),
                        rotulo="II –",
                    ),
                ],
            ),
            _no(
                "art12_cpt", ("2020-01-01", "Texto antigo de 2020."), ("2025-11-26", "Texto novo.")
            ),
            _no("art128_cpt", ("2025-11-26", "Outro artigo, 60%.")),
        ],
    }
).encode()


def _marco(**troca) -> config.Marco:
    base = {
        "id": "teste-dividendos",
        "vigencia": date(2026, 1, 1),
        "publico": ["pf"],
        "titulo": "Retenção de 10% acima de R$ 50 mil",
        "texto": "Retém 10% acima de R$ 50.000,00. Fica de fora o aprovado até 31/12/2025.",
        "lei": "Lei nº 9.250/1995, art. 6º-A",
        "url": "https://www.planalto.gov.br/x",
        "dispositivos": [f"{NORMA}!art6-1"],
    }
    return config.Marco(**{**base, **troca})


@pytest.fixture
def leis():
    return {NORMA: normas.parse(CORPO, NORMA)}


def test_parse_pega_versao_mais_recente_e_limpa_tags(leis):
    por_urn = {d.urn: d for d in leis[NORMA]}
    assert por_urn[f"{NORMA}!art12_cpt"].texto == "Texto novo."
    assert por_urn[f"{NORMA}!art6-1_cpt"].texto.startswith("A partir de 2026, retenção de 10%")


def test_trecho_nao_confunde_art12_com_art128(leis):
    assert [d.urn for d in normas.trecho(leis[NORMA], f"{NORMA}!art12")] == [f"{NORMA}!art12_cpt"]
    with pytest.raises(ValidationError, match="não encontrado"):
        normas.trecho(leis[NORMA], f"{NORMA}!art7")


def test_parse_de_outra_norma_falha():
    with pytest.raises(ValidationError, match="não é a norma"):
        normas.parse(CORPO, "urn:lex:br:federal:lei:1995-12-26;9250")


def test_numeros_com_mil_e_data_por_extenso_tem_lastro(leis):
    m = _marco()
    assert conferir_marcos.checa_numeros(m, conferir_marcos.texto_lei(m, leis)) == []


@pytest.mark.parametrize(
    "texto", ["Retém 15% acima de R$ 50.000,00.", "Fica de fora o aprovado até 30/12/2025."]
)
def test_numero_que_a_lei_nao_tem_reprova_sem_chamar_o_modelo(leis, texto):
    cliente = Cliente()
    c = conferir_marcos.confere(_marco(texto=texto), leis, client=cliente)
    assert not c.aprovado and c.modelo is None and cliente.pedidos == []
    assert "sem lastro" in c.motivos[0]


def test_marco_sem_dispositivo_falha():
    with pytest.raises(ValueError, match="dispositivos"):
        _marco(dispositivos=[])


def _resposta(confere: bool, trecho: str, divergencias=()):
    return _texto({
        "confere": confere,
        "afirmacoes": [{"afirmacao": "Retenção de 10%.", "trecho": trecho}],
        "divergencias": list(divergencias),
    })  # fmt: skip


def test_confere_com_trecho_da_lei_aprova(leis, tmp_path):
    cliente = Cliente(_resposta(True, "retenção de 10% acima de R$ 50.000,00"))
    c = conferir_marcos.confere(_marco(), leis, client=cliente, pasta=tmp_path)
    assert c.aprovado, c.motivos
    assert c.afirmacoes[0]["trecho"].startswith("retenção")


def test_trecho_copiado_do_marco_e_recusado(leis, tmp_path):
    so_no_marco = "Fica de fora o aprovado até 31/12/2025."
    ruim = _resposta(True, so_no_marco)
    c = conferir_marcos.confere(_marco(), leis, client=Cliente(ruim, ruim), pasta=tmp_path)
    assert not c.aprovado and not c.conclusiva  # o job tenta de novo na próxima execução
    assert any("não está no texto da lei" in p for p in c.motivos)


def test_trecho_de_dispositivo_lido_pela_ferramenta_e_aceito(leis, tmp_path):
    cliente = Cliente(
        _ferramenta("ler_dispositivo", urn=f"{NORMA}!art128"),
        _resposta(True, "Outro artigo, 60%."),
    )
    c = conferir_marcos.confere(_marco(), leis, client=cliente, pasta=tmp_path)
    assert c.aprovado, c.motivos


def test_modelo_que_aponta_divergencia_reprova(leis, tmp_path):
    resposta = _resposta(
        False, "retenção de 10% acima de R$ 50.000,00", ["A lei exige outra coisa."]
    )
    c = conferir_marcos.confere(_marco(), leis, client=Cliente(resposta), pasta=tmp_path)
    assert not c.aprovado and c.conclusiva and c.motivos == ["A lei exige outra coisa."]


def test_hash_muda_com_o_texto_da_lei(leis):
    m = _marco()
    lei = conferir_marcos.texto_lei(m, leis)
    assert conferir_marcos.hash_de(m, lei) != conferir_marcos.hash_de(m, lei + " alterado")
    assert conferir_marcos.hash_de(m, lei) != conferir_marcos.hash_de(_marco(texto="x"), lei)


def test_marcos_do_config_citam_urn_de_norma():
    for m in config.load_impostos().marcos:
        for urn in m.dispositivos:
            assert normas.norma_de(urn).startswith("urn:lex:br:federal:")


class Desfaz(Exception):
    pass


@pytest.mark.db
def test_job_reaproveita_conferencia_e_so_mostra_aprovado(leis, tmp_path, monkeypatch):
    raw = RawResponse(normas.SOURCE_ID, normas.API, CORPO, "application/json", datetime.now(UTC))
    monkeypatch.setattr(impostos, "baixa_normas", lambda marcos: (leis, {NORMA: raw}))
    store = LocalRawStore(tmp_path / "raw")
    bom, ruim = _marco(), _marco(id="teste-errado", texto="Retém 15% acima de R$ 50.000,00.")
    with db.connect() as conn, pytest.raises(Desfaz), conn.transaction():
        cliente = Cliente(_resposta(True, "retenção de 10% acima de R$ 50.000,00"))
        aprovados = impostos.confere_marcos(conn, store, [bom, ruim], Report(), client=cliente)
        assert set(aprovados) == {"teste-dividendos"}
        assert len(cliente.pedidos) == 1  # o reprovado pelos números não chama o modelo
        # Segunda execução: mesmo hash, nenhuma chamada nova.
        de_novo = impostos.confere_marcos(conn, store, [bom, ruim], Report(), client=Cliente())
        assert de_novo == aprovados
        # Conferência inconclusiva (resposta recusada) não é reaproveitada.
        talvez = _marco(id="teste-inconclusivo")
        invalida = _resposta(True, "trecho que não existe")
        impostos.confere_marcos(conn, store, [talvez], Report(), client=Cliente(invalida, invalida))
        outra = Cliente(_resposta(True, "retenção de 10% acima de R$ 50.000,00"))
        assert set(impostos.confere_marcos(conn, store, [talvez], Report(), client=outra)) == {
            "teste-inconclusivo"
        }
        impostos.grava_marcos(conn, [bom, ruim], aprovados)
        linhas = dict(conn.execute("select id, conferido_em from marcos_tributarios").fetchall())
        assert linhas["teste-dividendos"] is not None and linhas["teste-errado"] is None
        raise Desfaz
