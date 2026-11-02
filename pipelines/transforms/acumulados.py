"""Acumulados de séries de taxa. Ver docs/05 (armadilhas do SGS) e docs/07 (R2).

Variações percentuais não se somam: o acumulado é encadeado,
    acum = (Π (1 + x_i / 100) − 1) × 100.
Somar 12 meses de IPCA dá um número errado e fácil de ser apontado.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Context, Decimal, localcontext

from pipelines.models import Observation

_CTX = Context(prec=50)
_HUNDRED = Decimal(100)


def _months_between(a: date, b: date) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)


def chain(rates: list[Decimal]) -> Decimal:
    """Encadeia variações percentuais e devolve a variação acumulada, em %."""
    with localcontext(_CTX):
        factor = Decimal(1)
        for rate in rates:
            factor *= 1 + rate / _HUNDRED
        return (factor - 1) * _HUNDRED


def acumulado_n_meses(monthly: list[Observation], n: int = 12) -> list[Observation]:
    """Acumulado em `n` meses, por encadeamento, para cada mês com `n` meses consecutivos.

    Meses sem os `n` meses anteriores completos (início da série ou buraco) ficam de
    fora: nada é completado ou estimado.
    """
    if n < 1:
        raise ValueError("n precisa ser >= 1")
    ordered = sorted(monthly, key=lambda o: o.ref_date)
    for obs in ordered:
        if obs.ref_date.day != 1:
            raise ValueError(f"ref_date precisa ser o 1º dia do mês: {obs.ref_date}")
    out: list[Observation] = []
    for end in range(n - 1, len(ordered)):
        window = ordered[end - n + 1 : end + 1]
        if _months_between(window[0].ref_date, window[-1].ref_date) != n - 1:
            continue
        out.append(Observation(window[-1].ref_date, chain([o.value for o in window])))
    return out


def acumulado_12m(monthly: list[Observation]) -> list[Observation]:
    return acumulado_n_meses(monthly, 12)


@dataclass(frozen=True)
class Divergence:
    ref_date: date
    computed: Decimal
    published: Decimal

    @property
    def diff(self) -> Decimal:
        return abs(self.computed - self.published)


def tolerance(published: Decimal, abs_tol: Decimal, rel_tol: Decimal) -> Decimal:
    return abs_tol + rel_tol * abs(published)


# Tolerância derivada do arredondamento, não ajustada a olho.
# A variação mensal é publicada com 2 casas (erro ≤ 0,005 p.p. em cada mês) e o IBGE
# calcula o acumulado a partir do número-índice, sem arredondar. Encadear 12 taxas
# arredondadas gera erro de no máximo ≈ (1 + A/100) × Σ 0,005/(1 + x_i/100)
# ≤ 0,061 × (1 + A/100) p.p., mais 0,005 p.p. do arredondamento do próprio A.
# Na série real (dez/1980 a set/2026) o maior erro observado é 0,030 × (1 + A/100),
# em mai/1982; desde 2000 é ≤ 0,01 p.p. (ver pipelines/tests/test_acumulados.py).
DEFAULT_ABS_TOL = Decimal("0.066")  # 0,005 + 0,061
DEFAULT_REL_TOL = Decimal("0.00061")  # 0,061 / 100


def compare(
    computed: list[Observation],
    published: list[Observation],
    *,
    abs_tol: Decimal = DEFAULT_ABS_TOL,
    rel_tol: Decimal = DEFAULT_REL_TOL,
) -> tuple[int, list[Divergence]]:
    """Compara o acumulado calculado com o publicado. Devolve (meses comparados, divergências)."""
    pub = {o.ref_date: o.value for o in published}
    compared = 0
    divergences: list[Divergence] = []
    for obs in computed:
        if obs.ref_date not in pub:
            continue
        compared += 1
        d = Divergence(obs.ref_date, obs.value, pub[obs.ref_date])
        if d.diff > tolerance(d.published, abs_tol, rel_tol):
            divergences.append(d)
    return compared, divergences
