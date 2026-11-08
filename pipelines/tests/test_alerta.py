"""scripts/alerta.py com um `gh` falso: uma issue por problema, notificação só com novidade."""

import json

import pytest

from scripts import alerta


@pytest.fixture(autouse=True)
def _execucao(monkeypatch):
    """Execução fixa: no GitHub Actions as variáveis reais da execução do CI vazariam aqui."""
    monkeypatch.setenv("GITHUB_WORKFLOW_REF", "o/r/.github/workflows/coleta.yml@refs/heads/main")
    monkeypatch.setenv("GITHUB_RUN_ID", "1")
    monkeypatch.delenv("ALERTA_IMEDIATO", raising=False)


class GhFalso:
    def __init__(self, abertas=(), anterior="failure"):
        self.abertas = list(abertas)
        self.anterior = anterior
        self.chamadas: list[list[str]] = []

    def __call__(self, args):
        self.chamadas.append(args)
        if args[:2] == ["issue", "list"]:
            return json.dumps(self.abertas)
        if args[:2] == ["run", "list"]:
            return json.dumps([{"databaseId": 1, "conclusion": "in_progress"},
                               {"databaseId": 2, "conclusion": self.anterior}])  # fmt: skip
        return ""

    def acoes(self):
        return [c[:2] for c in self.chamadas if c[:2] not in (["issue", "list"], ["run", "list"])]


def test_primeira_falha_nao_abre_issue(tmp_path, monkeypatch):
    monkeypatch.setenv("GITHUB_WORKFLOW_REF", "o/r/.github/workflows/coleta.yml@refs/heads/main")
    monkeypatch.setenv("GITHUB_RUN_ID", "1")
    g = GhFalso(anterior="success")
    assert (
        alerta.alerta("coleta", "failure", _falhas(tmp_path, ["IBGE: 502"]), run=g) == "aguardando"
    )
    assert g.acoes() == []


def test_segunda_falha_seguida_abre_com_diagnostico(tmp_path, monkeypatch):
    monkeypatch.setenv("GITHUB_WORKFLOW_REF", "o/r/.github/workflows/coleta.yml@refs/heads/main")
    monkeypatch.setenv("GITHUB_RUN_ID", "1")
    diag = tmp_path / "d.md"
    diag.write_text("Causa: fonte_fora_do_ar")
    g = GhFalso(anterior="failure")
    r = alerta.alerta("coleta", "failure", _falhas(tmp_path, ["x"]), run=g, diagnostico=diag)
    assert r == "aberta"
    criar = next(c for c in g.chamadas if c[:2] == ["issue", "create"])
    assert "Causa: fonte_fora_do_ar" in criar[-1]


def _falhas(tmp_path, erros):
    p = tmp_path / "falhas-todos.json"
    p.write_text(json.dumps({"job": "todos", "erros": erros}))
    return p


def test_falha_sem_issue_abre_uma(tmp_path):
    g = GhFalso()
    assert alerta.alerta("coleta", "failure", _falhas(tmp_path, ["IBGE: 502"]), run=g) == "aberta"
    criar = next(c for c in g.chamadas if c[:2] == ["issue", "create"])
    assert "Alerta: coleta" in criar and "- IBGE: 502" in criar[-1]


def test_mesma_falha_so_atualiza_sem_notificar(tmp_path):
    body = alerta.corpo("coleta", ["IBGE: 502"], "x", alerta.datetime.now(alerta.UTC))
    g = GhFalso([{"number": 7, "title": "Alerta: coleta", "body": body}])
    assert (
        alerta.alerta("coleta", "failure", _falhas(tmp_path, ["IBGE: 502"]), run=g) == "atualizada"
    )
    assert g.acoes() == [["issue", "edit"]]


def test_falha_diferente_comenta(tmp_path):
    body = alerta.corpo("coleta", ["IBGE: 502"], "x", alerta.datetime.now(alerta.UTC))
    g = GhFalso([{"number": 7, "title": "Alerta: coleta", "body": body}])
    assert alerta.alerta("coleta", "failure", _falhas(tmp_path, ["BCB: 500"]), run=g) == "comentada"
    assert g.acoes() == [["issue", "edit"], ["issue", "comment"]]


def test_sucesso_fecha_a_issue_aberta():
    g = GhFalso([{"number": 7, "title": "Alerta: coleta", "body": ""}])
    assert alerta.alerta("coleta", "success", None, run=g) == "fechada"
    assert g.acoes() == [["issue", "comment"], ["issue", "close"]]


def test_sucesso_sem_issue_e_pulado_nao_fazem_nada():
    g = GhFalso([{"number": 8, "title": "Alerta: noticias", "body": ""}])
    assert alerta.alerta("coleta", "success", None, run=g) == "nada"
    assert alerta.alerta("coleta", "skipped", None, run=g) == "nada"
    assert g.acoes() == []


def test_tempo_limite_estourado_abre_alerta():
    # Job que passa de timeout-minutes termina como "cancelled" (coleta de 02/11/2026).
    g = GhFalso()
    assert alerta.alerta("coleta", "cancelled", None, run=g) == "aberta"
    criar = next(c for c in g.chamadas if c[:2] == ["issue", "create"])
    assert "tempo limite" in criar[-1]


def test_falha_antes_do_job_aponta_para_o_log(tmp_path):
    g = GhFalso()
    alerta.alerta("coleta", "failure", tmp_path / "nao-existe.json", run=g)
    criar = next(c for c in g.chamadas if c[:2] == ["issue", "create"])
    assert "Veja o log" in criar[-1]


def test_alerta_imediato_abre_na_primeira_falha(tmp_path, monkeypatch):
    monkeypatch.setenv("ALERTA_IMEDIATO", "1")
    g = GhFalso(anterior="success")
    assert alerta.alerta("auditoria", "failure", _falhas(tmp_path, ["x"]), run=g) == "aberta"
