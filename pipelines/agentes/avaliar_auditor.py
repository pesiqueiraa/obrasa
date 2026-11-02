"""Avaliação do auditor de textos com erros plantados. Gasta API.

Uso:
  AGENTES_DATABASE_URL=... ANTHROPIC_API_KEY=... uv run python -m pipelines.agentes.avaliar_auditor [id ...]

Cada caso de pipelines/agentes/avaliacao/auditar_textos.yaml vira um git worktree
descartável (a partir do HEAD) com as trocas do caso, e o auditor lê os textos dessa
cópia. Confere se o erro plantado virou achado de gravidade problema no arquivo certo, e
se o caso sem troca sai sem problema. O worktree é removido no fim, mesmo com erro.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

from pipelines import config, raw_store
from pipelines.agentes import auditar_textos, nucleo
from pipelines.agentes.avaliar_revisor import prepara
from pipelines.agentes.ferramentas import RAIZ, Ferramentas, conecta

CASOS = Path(__file__).parent / "avaliacao" / "auditar_textos.yaml"


def confere(caso: dict, saida: dict) -> list[str]:
    problemas = [a for a in saida["achados"] if a["gravidade"] == "problema"]
    if caso.get("limpo"):
        return [f"problema onde não há: {a['onde']} ({a['chave']})" for a in problemas]
    alvo = caso["achado_em"]
    certos = [
        a
        for a in problemas
        if a["onde"] == alvo["onde"] and ("chave" not in alvo or a["chave"] == alvo["chave"])
    ]
    return [] if certos else [f"sem problema apontado em {alvo['onde']}"]


def main() -> int:
    casos = yaml.safe_load(CASOS.read_text(encoding="utf-8"))["casos"]
    if sys.argv[1:]:
        casos = [c for c in casos if c["id"] in sys.argv[1:]]
    pasta = Path("data/agentes/avaliacao")
    errados, total = 0, 0.0
    with conecta() as conn:
        for caso in casos:
            with tempfile.TemporaryDirectory(prefix="obrasa-auditor-") as tmp:
                arvore = Path(tmp) / "repo"
                try:
                    prepara(caso, arvore, commit=False)
                    ferr = Ferramentas(
                        conn=conn,
                        store=raw_store.from_env(),
                        registry=config.load(arvore / "config"),
                        raiz=arvore,
                    )
                    r, _ = auditar_textos.audita(ferr, pasta=pasta)
                finally:
                    subprocess.run(
                        ["git", "-C", str(RAIZ), "worktree", "remove", "--force", str(arvore)],
                        capture_output=True,
                    )
            custo = nucleo.custo(r.uso)
            total += custo
            falhas = (
                ["recusado: " + "; ".join(r.problemas)[:200]]
                if not r.aceito
                else confere(caso, r.saida)
            )
            errados += bool(falhas)
            n = sum(a["gravidade"] == "problema" for a in r.saida["achados"]) if r.aceito else 0
            print(f"{'FALHA' if falhas else 'ok  '} {caso['id']}: {n} problema(s)"
                  f"{' (' + '; '.join(falhas) + ')' if falhas else ''} (US$ {custo:.2f})")  # fmt: skip
    print(f"\n{len(casos) - errados} de {len(casos)} casos certos, custo total US$ {total:.2f}")
    return 1 if errados else 0


if __name__ == "__main__":
    sys.exit(main())
