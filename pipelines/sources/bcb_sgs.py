"""Coletor do SGS do Banco Central. Ver docs/05-fontes-de-dados.md.

GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json
    &dataInicial=dd/MM/aaaa&dataFinal=dd/MM/aaaa
Resposta: [{"data": "01/07/2026", "valor": "0.07"}]

Testado em 01/11/2026: séries mensais aceitam o histórico inteiro numa requisição;
o modo ultimos/N aceita no máximo 20 registros. Séries diárias são buscadas em janelas
de até 10 anos (docs/05). A meta Selic (432) traz datas futuras, válidas até a próxima
reunião do Copom: quem chama corta no dia de hoje.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from pipelines import http
from pipelines.models import Observation, RawResponse, ValidationError

SOURCE_ID = "bcb_sgs"
BASE = "https://api.bcb.gov.br/dados/serie"


def fetch(codigo: int, inicio: date, fim: date) -> RawResponse:
    url = f"{BASE}/bcdata.sgs.{codigo}/dados"
    params = {
        "formato": "json",
        "dataInicial": inicio.strftime("%d/%m/%Y"),
        "dataFinal": fim.strftime("%d/%m/%Y"),
    }
    return http.get(SOURCE_ID, url, params=params)


JANELA_DIARIA_ANOS = 10


def windows(inicio: date, fim: date, anos: int = JANELA_DIARIA_ANOS) -> list[tuple[date, date]]:
    """Fatia [inicio, fim] em janelas de até `anos` anos, sem sobreposição."""
    out = []
    start = inicio
    while start <= fim:
        try:
            end = start.replace(year=start.year + anos) - timedelta(days=1)
        except ValueError:  # 29/02
            end = start.replace(year=start.year + anos, day=28) - timedelta(days=1)
        out.append((start, min(end, fim)))
        start = min(end, fim) + timedelta(days=1)
    return out


def parse(body: bytes, *, monthly: bool = True) -> list[Observation]:
    """Converte a resposta em observações. Datas dd/MM/aaaa e valores com ponto decimal."""
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"resposta não é JSON: {exc}") from exc
    if isinstance(payload, dict) and "erro" in payload:
        raise ValidationError(f"SGS respondeu com erro: {payload['erro']}")
    if not isinstance(payload, list) or not payload:
        raise ValidationError("resposta deveria ser uma lista não vazia")

    out: list[Observation] = []
    seen: set[date] = set()
    for item in payload:
        try:
            ref = datetime.strptime(item["data"], "%d/%m/%Y").date()
            value = Decimal(item["valor"])
        except (KeyError, TypeError, ValueError, InvalidOperation) as exc:
            raise ValidationError(f"item fora do formato: {item!r}") from exc
        if not value.is_finite():
            raise ValidationError(f"valor não finito: {item!r}")
        if monthly and ref.day != 1:
            raise ValidationError(f"série mensal com data fora do 1º dia: {item!r}")
        if ref in seen:
            raise ValidationError(f"data repetida: {item!r}")
        seen.add(ref)
        out.append(Observation(ref, value))
    return sorted(out, key=lambda o: o.ref_date)
