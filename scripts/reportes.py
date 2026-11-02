"""Issue "Reportes de erro aguardando leitura" enquanto houver reporte com status `novo`.

Uso (passo diário do workflow .github/workflows/atrasos.yml):
  DATABASE_URL=... GH_TOKEN=... uv run python scripts/reportes.py

A issue traz só a contagem e a data do mais antigo, nunca o texto: o repositório é
público e o texto do reporte não é (página /privacidade). Quem trata lê no painel do
Supabase (Table Editor → reportes) e muda o status. Sem reporte novo, a issue fecha.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipelines import db
from scripts.alerta import Gh, gh

TITULO = "Reportes de erro aguardando leitura"
ROTULO = "reporte"


def novos(conn) -> tuple[int, datetime | None]:
    return conn.execute(
        "select count(*), min(criado_em) from reportes where status = 'novo'"
    ).fetchone()


def corpo(n: int, mais_antigo: datetime) -> str:
    return "\n".join(
        [
            f"Há **{n}** reporte(s) de erro com status `novo`. O mais antigo é de "
            f"{mais_antigo:%d/%m/%Y}.",
            "",
            "1. Abra o painel do Supabase → Table Editor → `reportes`, filtrando `status = novo`.",
            "2. Confira cada um na fonte oficial.",
            "3. Mude o status (`em_analise`, `corrigido`, `sem_erro` ou `descartado`) e, se for o "
            "caso, registre a correção em `corrections` (aparece em /correcoes).",
            "",
            "O texto dos reportes não vem para cá: o repositório é público. Esta issue fecha "
            "sozinha quando não houver reporte novo.",
        ]
    )


def atualiza(n: int, mais_antigo: datetime | None, run: Gh = gh) -> str:
    abertas = json.loads(
        run(["issue", "list", "--label", ROTULO, "--state", "open", "--json", "number,title,body"])
        or "[]"
    )
    issue = next((i for i in abertas if i["title"] == TITULO), None)
    if n == 0 or mais_antigo is None:
        if not issue:
            return "nada"
        run(["issue", "close", str(issue["number"]), "--comment", "Nenhum reporte novo."])
        return "fechada"
    texto = corpo(n, mais_antigo)
    if issue:
        if issue.get("body") != texto:
            run(["issue", "edit", str(issue["number"]), "--body", texto])
            return "atualizada"
        return "igual"
    run(["label", "create", ROTULO, "--color", "23408E", "--force"])
    run(["issue", "create", "--title", TITULO, "--label", ROTULO, "--body", texto])
    return "aberta"


def main() -> int:
    with db.connect() as conn:
        n, mais_antigo = novos(conn)
    print(f"reportes novos: {n}; issue {atualiza(n, mais_antigo)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
