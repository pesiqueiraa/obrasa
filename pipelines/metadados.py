"""Conferência da descrição da série na fonte (nome, unidade, periodicidade, categorias).

Protege contra a fonte mudar o significado de um código sem mudar o formato: troca de
unidade, de base de um índice, de recorte da categoria. Nessas mudanças o JSON continua
válido e o valor pode continuar dentro da faixa plausível, então nenhuma outra trava
pegaria. A descrição esperada fica em `na_fonte` (config/sources.yaml e regional.yaml);
qualquer diferença para a coleta antes de gravar.

Diferença só de forma (maiúscula, acento, pontuação, espaço) passa com aviso no log: a
fonte trocar "Variação mensal" por "variação mensal" não muda o significado e não pode
parar a série. Qualquer diferença de palavra, número ou símbolo (%, R$) para a coleta.

Se a coleta parar aqui: leia a nota da fonte, confira se o número ainda significa o que
o site diz, ajuste `na_fonte` (e o que mais tiver mudado) e registre em docs/05.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from datetime import date
from decimal import Decimal

from pipelines.config import NaFonte
from pipelines.models import Descricao, Observation, ValidationError

CAMPOS = ("nome", "unidade", "periodicidade", "categorias")

log = logging.getLogger(__name__)
_PONTUACAO = re.compile(r"[.,;:()\[\]{}\"'“”‘’\-–—/_]+")


def forma(texto: str) -> str:
    """Texto sem maiúscula, acento, pontuação e espaço repetido. Mantém %, R$, =, números."""
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )
    return " ".join(_PONTUACAO.sub(" ", sem_acento.casefold()).split())


def _igual(a, b) -> bool:
    if isinstance(a, tuple) and isinstance(b, tuple):
        return len(a) == len(b) and all(_igual(x, y) for x, y in zip(a, b, strict=True))
    if isinstance(a, str) and isinstance(b, str):
        return forma(a) == forma(b)
    return a == b


def confere(esperado: NaFonte, encontrado: Descricao, onde: str) -> None:
    diffs = []
    for campo in CAMPOS:
        a, b = getattr(esperado, campo), getattr(encontrado, campo)
        if campo == "categorias":
            a, b = tuple(a), tuple(b)
        if a == b:
            continue
        if _igual(a, b):
            log.warning("%s: %s mudou só de forma na fonte: %r -> %r", onde, campo, a, b)
            continue
        diffs.append(f"{campo}: esperado {a!r}, a fonte declara {b!r}")
    if diffs:
        raise ValidationError(
            f"{onde}: a fonte mudou a descrição da série ({'; '.join(diffs)}). "
            "Confira o significado antes de atualizar `na_fonte` em config/ (pipelines/metadados.py)"
        )


def confere_ultimo(onde: str, ref: date, valor: Decimal, obs: list[Observation]) -> None:
    """O último valor dado por um segundo serviço da fonte precisa estar nos dados coletados."""
    dados = {o.ref_date: o.value for o in obs}
    if ref not in dados:
        raise ValidationError(
            f"{onde}: o webservice da fonte informa {valor} em {ref}, período que a coleta não trouxe"
        )
    if dados[ref] != valor:
        raise ValidationError(
            f"{onde}: dois serviços da fonte discordam em {ref}: "
            f"dados {dados[ref]}, webservice {valor}"
        )
