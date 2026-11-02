"""scripts/alerta.py com um `gh` falso: uma issue por problema, notificação só com novidade."""

import json

from scripts import alerta


class GhFalso:
    def __init__(self, abertas=()):
        self.abertas = list(abertas)
        self.chamadas: list[list[str]] = []

    def __call__(self, args):
        self.chamadas.append(args)
        if args[:2] == ["issue", "list"]:
            return json.dumps(self.abertas)
        return ""

    def acoes(self):
        return [c[:2] for c in self.chamadas if c[:2] != ["issue", "list"]]


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


def test_sucesso_sem_issue_e_cancelado_nao_fazem_nada():
    g = GhFalso([{"number": 8, "title": "Alerta: noticias", "body": ""}])
    assert alerta.alerta("coleta", "success", None, run=g) == "nada"
    assert alerta.alerta("coleta", "cancelled", None, run=g) == "nada"
    assert g.acoes() == []


def test_falha_antes_do_job_aponta_para_o_log(tmp_path):
    g = GhFalso()
    alerta.alerta("coleta", "failure", tmp_path / "nao-existe.json", run=g)
    criar = next(c for c in g.chamadas if c[:2] == ["issue", "create"])
    assert "Veja o log" in criar[-1]
