"""Expectativas de mercado (Focus) do Banco Central, API Olinda. Ver docs/05.

GET .../Expectativas/versao/v1/odata/ExpectativasMercadoAnuais
    ?$filter=Data eq 'AAAA-MM-DD' and baseCalculo eq 0&$format=json

Testado em 07/11/2026. Os espaços vão como %20: com "+" a API responde 400. `baseCalculo`
0 usa as respostas dos últimos 30 dias; 1, dos últimos 5 dias úteis. Usamos 0.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from urllib.parse import quote

from pipelines import http
from pipelines.models import RawResponse, ValidationError

SOURCE_ID = "bcb_focus"
BASE = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"
BASE_CALCULO = 0


@dataclass(frozen=True)
class Expectativa:
    indicador: str
    data_pesquisa: date
    ano_referencia: int
    mediana: Decimal
    respondentes: int | None


def _url(conjunto: str, params: dict[str, str]) -> str:
    seguros = "'(),"
    q = "&".join(f"${k}={quote(v, safe=seguros)}" for k, v in params.items())
    return f"{BASE}/{conjunto}?{q}"


def fetch_ultima_data() -> RawResponse:
    """Data da pesquisa mais recente publicada."""
    url = _url(
        "ExpectativasMercadoAnuais",
        {"top": "1", "select": "Data", "orderby": "Data desc", "format": "json"},
    )
    return http.get(SOURCE_ID, url)


def parse_ultima_data(body: bytes) -> date:
    itens = _valores(body)
    if not itens:
        raise ValidationError("Focus: nenhuma pesquisa publicada")
    return date.fromisoformat(itens[0]["Data"])


def fetch_pesquisa(dia: date) -> RawResponse:
    url = _url(
        "ExpectativasMercadoAnuais",
        {
            "filter": f"Data eq '{dia.isoformat()}' and baseCalculo eq {BASE_CALCULO}",
            "select": "Indicador,IndicadorDetalhe,Data,DataReferencia,Mediana,numeroRespondentes,baseCalculo",
            "top": "5000",
            "format": "json",
        },
    )
    return http.get(SOURCE_ID, url)


def _valores(body: bytes) -> list[dict]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"Focus: resposta não é JSON: {exc}") from exc
    itens = payload.get("value") if isinstance(payload, dict) else None
    if not isinstance(itens, list):
        raise ValidationError("Focus: resposta sem lista 'value'")
    return itens


def parse_pesquisa(body: bytes, indicadores: set[str], dia: date) -> list[Expectativa]:
    """Medianas anuais dos `indicadores` pedidos na pesquisa de `dia`."""
    out = []
    for it in _valores(body):
        if it.get("Indicador") not in indicadores or it.get("IndicadorDetalhe"):
            continue
        try:
            e = Expectativa(
                indicador=it["Indicador"],
                data_pesquisa=date.fromisoformat(it["Data"]),
                ano_referencia=int(it["DataReferencia"]),
                mediana=Decimal(str(it["Mediana"])),
                respondentes=int(it["numeroRespondentes"])
                if it.get("numeroRespondentes")
                else None,
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ValidationError(f"Focus: item fora do formato: {it!r}") from exc
        if e.data_pesquisa != dia or it.get("baseCalculo") != BASE_CALCULO:
            raise ValidationError(f"Focus: item de outra pesquisa ou base de cálculo: {it!r}")
        out.append(e)
    faltam = indicadores - {e.indicador for e in out}
    if faltam:
        raise ValidationError(f"Focus: pesquisa de {dia} sem {sorted(faltam)}")
    return out
