"""Verificador de termos proibidos (docs/02, seção 4).

Uso: uv run python scripts/check_terms.py
Sai com código 1 e lista arquivo:linha quando encontra termo proibido.
A lista fica em config/forbidden_terms.yaml.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from fnmatch import fnmatch
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
ALLOW = "termos-ok"


@dataclass(frozen=True)
class Hit:
    path: str
    line: int
    match: str
    usar: str


def load_rules(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def check_text(text: str, rel: str, rules: dict) -> list[Hit]:
    patterns = [(re.compile(t["padrao"], re.IGNORECASE), t["usar"]) for t in rules["termos"]]
    check_bang = any(fnmatch(rel, g) for g in rules.get("exclamacao_em", []))
    hits: list[Hit] = []
    for n, line in enumerate(text.splitlines(), start=1):
        if ALLOW in line:
            continue
        for rx, usar in patterns:
            for m in rx.finditer(line):
                hits.append(Hit(rel, n, m.group(0), usar))
        if check_bang and not line.lstrip().startswith("#") and "!" in line:
            hits.append(Hit(rel, n, "!", "sem ponto de exclamação em textos sobre dados"))
    return hits


def files(rules: dict, root: Path) -> list[Path]:
    out: set[Path] = set()
    for pattern in rules["verificar"]:
        out.update(p for p in root.glob(pattern) if p.is_file())
    ignore = rules.get("ignorar", [])
    return sorted(p for p in out if not any(fnmatch(str(p.relative_to(root)), g) for g in ignore))


def main(root: Path = ROOT) -> int:
    rules = load_rules(root / "config" / "forbidden_terms.yaml")
    checked = files(rules, root)
    hits: list[Hit] = []
    for path in checked:
        rel = str(path.relative_to(root))
        hits.extend(check_text(path.read_text(encoding="utf-8"), rel, rules))
    for h in hits:
        print(f"{h.path}:{h.line}: termo proibido '{h.match}'. Use: {h.usar}")
    if hits:
        print(
            f"\n{len(hits)} ocorrência(s). Guia: docs/02-principios-de-neutralidade.md#4-linguagem-sem-adjetivo"
        )
        return 1
    print(f"OK: {len(checked)} arquivos sem termos proibidos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
