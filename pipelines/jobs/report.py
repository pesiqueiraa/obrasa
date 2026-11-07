"""Relatório de um job: o que foi gravado, avisos e erros (erro faz o job sair com 1)."""

from __future__ import annotations

from dataclasses import dataclass, field

from pipelines import db


@dataclass
class Report:
    summaries: list[db.WriteSummary] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def falhou(self, onde: str, exc: Exception) -> None:
        """Erro de uma série ou fonte. Salto esperando confirmação automática é aviso."""
        from pipelines.saltos import SaltoEmEspera

        (self.warnings if isinstance(exc, SaltoEmEspera) else self.errors).append(f"{onde}: {exc}")

    def merge(self, other: Report) -> Report:
        self.summaries += other.summaries
        self.errors += other.errors
        self.warnings += other.warnings
        return self
