"""Avaliação do investigador com casos de causa conhecida. Gasta API.

Uso:
  AGENTES_DATABASE_URL=... ANTHROPIC_API_KEY=... uv run python -m pipelines.agentes.avaliar [id ...]

Sem argumentos, roda todos os casos; com ids, só esses.

Para cada caso de pipelines/agentes/avaliacao/investigar.yaml roda o investigador de
verdade e confere: diagnóstico aceito pelas verificações, causa entre as esperadas e
nenhum trecho proibido. Imprime acertos e custo por caso. Os diagnósticos ficam em
data/agentes/avaliacao/. Sai com 1 se algum caso falhar.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import yaml

from pipelines import config, raw_store
from pipelines.agentes import investigar
from pipelines.agentes.ferramentas import Ferramentas, conecta

CASOS = Path(__file__).parent / "avaliacao" / "investigar.yaml"


@dataclass
class _ComBrutosDeTeste:
    """Store real mais respostas brutas de teste em memória (endereços teste://)."""

    real: raw_store.RawStore
    extras: dict[str, bytes]

    def save(self, raw, name):  # o agente nunca grava; só para cumprir o protocolo
        raise RuntimeError("avaliação não grava respostas brutas")

    def read(self, ref: str) -> bytes:
        return self.extras[ref] if ref in self.extras else self.real.read(ref)


def avalia(caso: dict, ferr: Ferramentas, pasta: Path) -> tuple[bool, str, float]:
    falhas = {"executado_em": "avaliação", "avisos": [], **caso["falhas"]}
    r, arquivo = investigar.investiga(falhas, ferr, pasta=pasta)
    if not r.aceito:
        return False, f"recusado: {'; '.join(r.problemas)[:200]}", investigar.custo(r.uso)
    causa = r.saida["causa"]
    texto = arquivo.read_text(encoding="utf-8")
    escrito_pelo_agente = texto.split("## Causa", 1)[1] if "## Causa" in texto else ""
    vazou = [p for p in caso.get("proibido", []) if p in escrito_pelo_agente]
    ordem = ["baixa", "media", "alta"]
    confianca = r.saida["confianca"]
    acima = ordem.index(confianca) > ordem.index(caso.get("confianca_maxima", "alta"))
    ok = causa in caso["esperado"] and not vazou and not acima
    detalhe = f"causa {causa}, confiança {confianca}"
    detalhe += f", trecho proibido {vazou}" if vazou else ""
    detalhe += ", confiança acima do permitido" if acima else ""
    return ok, detalhe, investigar.custo(r.uso)


def main() -> int:
    casos = yaml.safe_load(CASOS.read_text(encoding="utf-8"))["casos"]
    if sys.argv[1:]:
        casos = [c for c in casos if c["id"] in sys.argv[1:]]
    pasta = Path("data/agentes/avaliacao")
    registry = config.load()
    falhou = 0
    total = 0.0
    with conecta() as conn:
        for caso in casos:
            extras = {k: v.encode() for k, v in caso.get("brutos", {}).items()}
            store = _ComBrutosDeTeste(raw_store.from_env(), extras)
            ferr = Ferramentas(conn=conn, store=store, registry=registry)
            ok, detalhe, custo = avalia(caso, ferr, pasta)
            total += custo
            falhou += not ok
            print(f"{'ok  ' if ok else 'FALHA'} {caso['id']}: {detalhe} (US$ {custo:.2f})")
    print(f"\n{len(casos) - falhou} de {len(casos)} casos certos, custo total US$ {total:.2f}")
    return 1 if falhou else 0


if __name__ == "__main__":
    sys.exit(main())
