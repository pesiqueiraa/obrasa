"""Tipos compartilhados entre coletores, transformações e gravação."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal


class ValidationError(Exception):
    """A resposta da fonte não tem o formato esperado. Nada deve ser gravado."""


@dataclass(frozen=True)
class Observation:
    """Um valor de uma série num período. ref_date é sempre o 1º dia do período."""

    ref_date: date
    value: Decimal


@dataclass(frozen=True)
class RawResponse:
    """Resposta bruta de uma fonte, guardada antes de qualquer transformação."""

    source_id: str
    url: str
    body: bytes
    content_type: str
    fetched_at: datetime


@dataclass(frozen=True)
class Descricao:
    """O que a fonte declara sobre uma série: nome, unidade, periodicidade e, no IBGE, o
    nome de cada categoria filtrada. Conferido a cada coleta (pipelines/metadados.py)."""

    nome: str
    unidade: str
    periodicidade: str
    categorias: tuple[str, ...] = ()
