"""Verificador de números: nenhum número no texto de um agente sem lastro (regra 1).

O agente escreve diagnósticos e revisões em texto. Este verificador extrai cada número
e cada data do texto e exige que apareçam, exatamente, no lastro: as saídas das
ferramentas (`Ferramentas.saidas`) e a entrada que o agente recebeu. Arredondar também
conta como inventar: "0,8%" não tem lastro em "0.82". Texto com número sem lastro é
recusado inteiro.

Formatos reconhecidos, no texto e no lastro:
  * números em formato brasileiro (1.234,5) e técnico (1234.5); quando a escrita é
    ambígua (1.234 pode ser mil duzentos e trinta e quatro ou um vírgula dois três
    quatro), basta uma das leituras ter lastro;
  * datas 26/10/2026 e 2026-10-26 (comparadas como data), e mês/ano como set/2026
    (precisa de alguma data daquele mês no lastro).

Inteiros de 0 a 10 ficam de fora: aparecem em contagens e enumerações ("2 períodos",
"passo 3") e travariam quase todo texto. Qualquer valor com casa decimal, ou maior que
10, precisa de lastro.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

MESES = {
    m: i + 1
    for i, m in enumerate(
        ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
    )
}
ISENTOS_ATE = 10

_DATA_BR = re.compile(r"(?<![\d/])(\d{1,2})/(\d{1,2})/(\d{4})(?![\d/])")
_DATA_ISO = re.compile(r"(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d])")
_MES_ANO = re.compile(r"(?i)\b(" + "|".join(MESES) + r")/(\d{4})\b")
_NUMERO = re.compile(r"\d+(?:[.,]\d+)*")


@dataclass(frozen=True)
class SemLastro:
    trecho: str
    motivo: str


def _canon(texto: str) -> str | None:
    try:
        d = Decimal(texto)
    except InvalidOperation:
        return None
    d = d.normalize()
    return format(d, "f") if d == d.to_integral() else str(d)


def leituras(token: str) -> set[str]:
    """Valores possíveis de um número escrito, normalizados (sem zeros à direita)."""
    if "." in token and "," in token:
        decimal = "," if token.rfind(",") > token.rfind(".") else "."
        milhar = "." if decimal == "," else ","
        opcoes = [token.replace(milhar, "").replace(decimal, ".")]
    elif "," in token:
        opcoes = [token.replace(",", ".")] if token.count(",") == 1 else []
        if re.fullmatch(r"\d{1,3}(,\d{3})+", token):
            opcoes.append(token.replace(",", ""))
    elif "." in token:
        opcoes = [token] if token.count(".") == 1 else []
        if re.fullmatch(r"\d{1,3}(\.\d{3})+", token):
            opcoes.append(token.replace(".", ""))
    else:
        opcoes = [token]
    return {c for o in opcoes if (c := _canon(o)) is not None}


def _data(a: int, m: int, d: int) -> date | None:
    try:
        return date(a, m, d)
    except ValueError:
        return None


def _extrai(texto: str):
    """(datas, meses, números, trechos) e o texto sem as datas."""
    datas: list[tuple[str, date | None]] = []
    meses: list[tuple[str, tuple[int, int]]] = []

    def tira_br(m):
        datas.append((m.group(0), _data(int(m[3]), int(m[2]), int(m[1]))))
        return " "

    def tira_iso(m):
        datas.append((m.group(0), _data(int(m[1]), int(m[2]), int(m[3]))))
        return " "

    def tira_mes(m):
        meses.append((m.group(0), (int(m[2]), MESES[m[1].lower()])))
        return " "

    resto = _DATA_BR.sub(tira_br, texto)
    resto = _DATA_ISO.sub(tira_iso, resto)
    resto = _MES_ANO.sub(tira_mes, resto)
    numeros = [(m.group(0), leituras(m.group(0))) for m in _NUMERO.finditer(resto)]
    return datas, meses, numeros


@dataclass(frozen=True)
class Lastro:
    numeros: frozenset[str]
    datas: frozenset[date]
    meses: frozenset[tuple[int, int]]

    @classmethod
    def de(cls, fontes: Iterable[str]) -> Lastro:
        numeros: set[str] = set()
        datas: set[date] = set()
        meses: set[tuple[int, int]] = set()
        for texto in fontes:
            ds, ms, ns = _extrai(texto)
            for _, d in ds:
                if d:
                    datas.add(d)
                    meses.add((d.year, d.month))
                    numeros.update({str(d.year), str(d.month), str(d.day)})
            meses.update(m for _, m in ms)
            for _, ls in ns:
                numeros.update(ls)
        return cls(frozenset(numeros), frozenset(datas), frozenset(meses))


def verifica(texto: str, lastro: Lastro) -> list[SemLastro]:
    """Tudo o que o texto afirma em número e não tem lastro. Lista vazia: texto aceito."""
    problemas = []
    datas, meses, numeros = _extrai(texto)
    for trecho, d in datas:
        if d is None:
            problemas.append(SemLastro(trecho, "data inválida"))
        elif d not in lastro.datas:
            problemas.append(SemLastro(trecho, "data que nenhuma ferramenta mostrou"))
    for trecho, m in meses:
        if m not in lastro.meses:
            problemas.append(SemLastro(trecho, "mês que nenhuma ferramenta mostrou"))
    for trecho, ls in numeros:
        if not ls:
            problemas.append(SemLastro(trecho, "número em formato que não dá para ler"))
            continue
        if all(Decimal(v) == Decimal(v).to_integral() and Decimal(v) <= ISENTOS_ATE for v in ls):
            continue
        if not ls & lastro.numeros:
            problemas.append(SemLastro(trecho, "número que nenhuma ferramenta mostrou"))
    return problemas
