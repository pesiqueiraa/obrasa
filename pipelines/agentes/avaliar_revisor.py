"""Avaliação do revisor com erros plantados. Gasta API.

Uso:
  AGENTES_DATABASE_URL=... ANTHROPIC_API_KEY=... uv run python -m pipelines.agentes.avaliar_revisor [id ...]

Cada caso de pipelines/agentes/avaliacao/revisar.yaml vira um commit num git worktree
descartável (a partir do HEAD), e o revisor revisa esse commit. Confere o veredito e se
o arquivo certo foi comentado. O worktree é removido no fim, mesmo com erro.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

from pipelines import config, raw_store
from pipelines.agentes import nucleo, revisar
from pipelines.agentes.ferramentas import RAIZ, Ferramentas, conecta

CASOS = Path(__file__).parent / "avaliacao" / "revisar.yaml"


def _git(raiz: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(raiz), *args], check=True, capture_output=True)


def prepara(caso: dict, destino: Path) -> None:
    _git(RAIZ, "worktree", "add", "--detach", str(destino), "HEAD")
    for t in caso["trocas"]:
        alvo = destino / t["arquivo"]
        texto = alvo.read_text(encoding="utf-8")
        if texto.count(t["de"]) != 1:
            raise ValueError(f"{caso['id']}: trecho de {t['arquivo']} não é único ou não existe")
        alvo.write_text(texto.replace(t["de"], t["para"]), encoding="utf-8")
    _git(destino, "-c", "user.email=avaliacao@obrasa", "-c", "user.name=avaliacao",
         "commit", "-qam", f"avaliação: {caso['id']}")  # fmt: skip


def confere(caso: dict, saida: dict) -> list[str]:
    falhas = []
    if saida["veredito"] not in caso["esperado"]:
        falhas.append(f"veredito {saida['veredito']}")
    if "comentario_em" in caso:
        no_arquivo = [c for c in saida["comentarios"] if c["arquivo"] == caso["comentario_em"]]
        if caso.get("regras"):
            no_arquivo = [c for c in no_arquivo if c["regra"] in caso["regras"]]
        if not no_arquivo:
            falhas.append(f"sem comentário em {caso['comentario_em']} com a regra esperada")
    if "sem_problema_em" in caso and any(
        c["arquivo"] == caso["sem_problema_em"] and c["gravidade"] == "problema"
        for c in saida["comentarios"]
    ):
        falhas.append("apontou problema numa mudança correta")
    return falhas


def main() -> int:
    casos = yaml.safe_load(CASOS.read_text(encoding="utf-8"))["casos"]
    if sys.argv[1:]:
        casos = [c for c in casos if c["id"] in sys.argv[1:]]
    pasta = Path("data/agentes/avaliacao")
    errados, total = 0, 0.0
    with conecta() as conn:
        for caso in casos:
            with tempfile.TemporaryDirectory(prefix="obrasa-revisor-") as tmp:
                arvore = Path(tmp) / "repo"
                try:
                    prepara(caso, arvore)
                    ferr = Ferramentas(
                        conn=conn,
                        store=raw_store.from_env(),
                        registry=config.load(arvore / "config"),
                        raiz=arvore,
                    )
                    r, _ = revisar.revisa(revisar.Diff(arvore, "HEAD~1", "HEAD", ferr), pasta=pasta)
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
            detalhe = r.saida["veredito"] if r.aceito else "recusado"
            print(f"{'FALHA' if falhas else 'ok  '} {caso['id']}: {detalhe}"
                  f"{' (' + '; '.join(falhas) + ')' if falhas else ''} (US$ {custo:.2f})")  # fmt: skip
    print(f"\n{len(casos) - errados} de {len(casos)} casos certos, custo total US$ {total:.2f}")
    return 1 if errados else 0


if __name__ == "__main__":
    sys.exit(main())
