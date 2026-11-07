"""Alerta de falha como issue do GitHub: uma issue aberta por problema, não um e-mail por execução.

Uso (passo final de cada workflow agendado, com `if: always()`):
  uv run python scripts/alerta.py <nome> <success|failure|cancelled> [falhas.json [diagnostico.md]]

- failure, sem issue aberta: se a execução anterior do mesmo workflow também falhou, abre
  "Alerta: <nome>" com os erros, o diagnóstico do investigador e o link da execução. Se
  foi a primeira falha, não abre nada: fonte fora do ar por algumas horas se resolve
  sozinha, e o site continua com o último valor validado. Com ALERTA_IMEDIATO=1
  (auditoria e backup), abre na primeira falha.
- failure, com issue aberta e os mesmos erros: só atualiza o corpo (sem notificar).
  Com erros diferentes: comenta, e quem acompanha recebe a novidade.
- success, com issue aberta: comenta que voltou a funcionar e fecha.
- cancelled: nada.

Os erros vêm do JSON que `pipelines.run` grava (data/agentes/falhas-<job>.json). Sem o
arquivo (a falha foi antes do job, ex.: testes contra a fonte), a issue aponta para o log.
Precisa de GH_TOKEN e das variáveis padrão do Actions (GITHUB_REPOSITORY, GITHUB_RUN_ID,
GITHUB_SERVER_URL). O workflow precisa de `permissions: issues: write`.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

ROTULO = "alerta"
_ASSINATURA = re.compile(r"<!-- assinatura: (\w+) -->")

Gh = Callable[[list[str]], str]


def gh(args: list[str]) -> str:
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def link_execucao() -> str:
    servidor = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    execucao = os.environ.get("GITHUB_RUN_ID", "")
    return f"{servidor}/{repo}/actions/runs/{execucao}" if repo and execucao else "(sem link)"


def erros_de(falhas: Path | None) -> list[str]:
    if falhas and falhas.is_file():
        return json.loads(falhas.read_text(encoding="utf-8")).get("erros", [])
    return []


def assinatura(erros: list[str]) -> str:
    return hashlib.sha256("\n".join(sorted(erros)).encode()).hexdigest()[:16]


def anterior_falhou(run: Gh) -> bool:
    """A execução concluída anterior deste workflow falhou? Sem dado, sim (falha fechada).
    ALERTA_IMEDIATO=1 (auditoria, backup semanal) abre na primeira falha."""
    if os.environ.get("ALERTA_IMEDIATO") == "1":
        return True
    workflow = os.environ.get("GITHUB_WORKFLOW_REF", "").split("@")[0].rsplit("/", 1)[-1]
    atual = os.environ.get("GITHUB_RUN_ID", "")
    if not workflow:
        return True
    try:
        saida = run(["run", "list", "--workflow", workflow, "--status", "completed",
                     "--limit", "5", "--json", "databaseId,conclusion"])  # fmt: skip
        execucoes = [e for e in json.loads(saida or "[]") if str(e["databaseId"]) != atual]
    except (subprocess.CalledProcessError, ValueError, KeyError):
        return True
    return not execucoes or execucoes[0]["conclusion"] in ("failure", "cancelled", "timed_out")


def diagnostico_de(arquivo: Path | None) -> str | None:
    if arquivo and arquivo.is_file():
        return arquivo.read_text(encoding="utf-8").strip()[:20000]
    return None


def corpo(
    nome: str, erros: list[str], link: str, agora: datetime, diagnostico: str | None = None
) -> str:
    linhas = [
        f"O job **{nome}** falhou. Última falha: {agora:%d/%m/%Y %H:%M} UTC ([execução]({link})).",
        "",
        "Nada foi gravado pela parte que falhou: as travas da coleta recusam o dado "
        "inteiro (docs/06). O site continua mostrando o último valor validado.",
        "",
        "## Erros",
        "",
        *(
            [f"- {e}" for e in erros]
            or [
                "- A falha foi antes do job gravar os erros, ou o job passou do tempo limite "
                "(uma fonte que parou de responder). Veja o log."
            ]
        ),
        "",
        *(
            ["## Diagnóstico automático (pipelines/agentes/investigar.py)", "", diagnostico, ""]
            if diagnostico
            else []
        ),
        "Esta issue fecha sozinha quando o job voltar a funcionar.",
        "",
        f"<!-- assinatura: {assinatura(erros)} -->",
    ]
    return "\n".join(linhas)


def aberta(nome: str, run: Gh) -> dict | None:
    saida = run(
        ["issue", "list", "--label", ROTULO, "--state", "open", "--json", "number,title,body"]
    )
    titulo = f"Alerta: {nome}"
    return next((i for i in json.loads(saida or "[]") if i["title"] == titulo), None)


def alerta(
    nome: str,
    status: str,
    falhas: Path | None,
    run: Gh = gh,
    agora: datetime | None = None,
    diagnostico: Path | None = None,
) -> str:
    """Abre, atualiza, comenta ou fecha a issue do job. Devolve o que foi feito."""
    # "cancelled" também é falha: é o status de um job que passou do tempo limite
    # (timeout-minutes), como uma fonte que para de responder. "skipped" não faz nada.
    if status not in ("success", "failure", "cancelled"):
        return "nada"
    agora = agora or datetime.now(UTC)
    issue = aberta(nome, run)
    link = link_execucao()
    if status == "success":
        if not issue:
            return "nada"
        num = str(issue["number"])
        run(["issue", "comment", num, "--body", f"Voltou a funcionar ([execução]({link}))."])
        run(["issue", "close", num])
        return "fechada"
    erros = erros_de(falhas)
    texto = corpo(nome, erros, link, agora, diagnostico_de(diagnostico))
    if not issue and not anterior_falhou(run):
        return "aguardando"  # primeira falha: abre só se a próxima execução falhar também
    if not issue:
        run(["label", "create", ROTULO, "--color", "B60205", "--force"])
        run(["issue", "create", "--title", f"Alerta: {nome}", "--label", ROTULO, "--body", texto])
        return "aberta"
    num = str(issue["number"])
    anterior = _ASSINATURA.search(issue.get("body") or "")
    run(["issue", "edit", num, "--body", texto])
    if anterior and anterior[1] == assinatura(erros):
        return "atualizada"
    novos = "\n".join(f"- {e}" for e in erros) or "- Veja o log."
    run(["issue", "comment", num, "--body", f"Os erros mudaram ([execução]({link})):\n\n{novos}"])
    return "comentada"


def main(argv: list[str]) -> int:
    if len(argv) not in (2, 3, 4):
        print(__doc__)
        return 2
    falhas = Path(argv[2]) if len(argv) >= 3 else None
    diag = Path(argv[3]) if len(argv) == 4 and argv[3] else None
    print(f"alerta {argv[0]}: {alerta(argv[0], argv[1], falhas, diagnostico=diag)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
