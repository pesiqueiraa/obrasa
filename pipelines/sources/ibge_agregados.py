"""Coletor da API de Agregados v3 do IBGE (SIDRA). Ver docs/05-fontes-de-dados.md.

Endpoints usados (testados em 01/11/2026):
  GET /api/v3/agregados/{tabela}/periodos/{periodos}/variaveis/{v1|v2}?localidades=N1[all]
  GET /api/v3/agregados/{tabela}/periodos
  GET /api/v3/calendario/{produto}?de=MM-DD-AAAA&ate=MM-DD-AAAA
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from pipelines import http
from pipelines.models import Observation, RawResponse, ValidationError

SOURCE_ID = "ibge_agregados"
BASE = "https://servicodados.ibge.gov.br/api/v3"
MISSING = {"...", "-", "..", "X", ""}
TZ = ZoneInfo("America/Sao_Paulo")
_PERIOD = re.compile(r"^(\d{4})(\d{2})$")


def fetch_variables(tabela: int, variaveis: list[int], periodos: str) -> RawResponse:
    """Busca as variáveis da tabela para o Brasil (N1).

    `periodos` aceita intervalo ("197912-202609"), lista ("202608|202609")
    ou os últimos N períodos ("-N").
    """
    vars_ = "|".join(str(v) for v in variaveis)
    url = f"{BASE}/agregados/{tabela}/periodos/{periodos}/variaveis/{vars_}"
    return http.get(SOURCE_ID, url, params={"localidades": "N1[all]"})


def fetch_periods(tabela: int) -> RawResponse:
    return http.get(SOURCE_ID, f"{BASE}/agregados/{tabela}/periodos")


def fetch_calendar(produto: int, de: date, ate: date) -> RawResponse:
    params = {"de": de.strftime("%m-%d-%Y"), "ate": ate.strftime("%m-%d-%Y")}
    return http.get(SOURCE_ID, f"{BASE}/calendario/{produto}", params=params)


def period_to_date(period: str) -> date:
    m = _PERIOD.match(period)
    if not m:
        raise ValidationError(f"período fora do formato AAAAMM: {period!r}")
    year, month = int(m.group(1)), int(m.group(2))
    if not 1 <= month <= 12:
        raise ValidationError(f"mês inválido no período {period!r}")
    return date(year, month, 1)


def date_to_period(d: date) -> str:
    return f"{d.year:04d}{d.month:02d}"


def _parse_value(raw: object, where: str) -> Decimal | None:
    if not isinstance(raw, str):
        raise ValidationError(f"{where}: valor deveria ser texto, veio {type(raw).__name__}")
    if raw.strip() in MISSING:
        return None
    try:
        value = Decimal(raw)
    except InvalidOperation as exc:
        raise ValidationError(f"{where}: valor não numérico {raw!r}") from exc
    if not value.is_finite():
        raise ValidationError(f"{where}: valor não finito {raw!r}")
    return value


def parse_variables(body: bytes, variaveis: list[int]) -> dict[int, list[Observation]]:
    """Converte a resposta em observações por variável, validando o layout.

    Falha (ValidationError) se faltar variável, se vier localidade diferente de Brasil,
    se houver classificação inesperada ou valor fora do formato. Valores marcados como
    ausentes pela fonte ("...", "-") são omitidos, nunca convertidos em zero.
    """
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"resposta não é JSON: {exc}") from exc
    if not isinstance(payload, list):
        raise ValidationError("resposta deveria ser uma lista de variáveis")

    found: dict[int, list[Observation]] = {}
    for item in payload:
        try:
            var_id = int(item["id"])
            resultados = item["resultados"]
        except (KeyError, TypeError, ValueError) as exc:
            raise ValidationError(f"variável sem id/resultados: {exc}") from exc
        if var_id not in variaveis:
            raise ValidationError(f"variável inesperada na resposta: {var_id}")
        if len(resultados) != 1 or resultados[0].get("classificacoes"):
            raise ValidationError(f"variável {var_id}: esperado 1 resultado sem classificação")
        series_list = resultados[0].get("series") or []
        if len(series_list) != 1:
            raise ValidationError(f"variável {var_id}: esperada 1 série (Brasil)")
        localidade = series_list[0].get("localidade", {})
        if localidade.get("id") != "1" or localidade.get("nivel", {}).get("id") != "N1":
            raise ValidationError(f"variável {var_id}: localidade inesperada {localidade}")
        serie = series_list[0].get("serie")
        if not isinstance(serie, dict) or not serie:
            raise ValidationError(f"variável {var_id}: série vazia")
        observations = []
        for period, raw in serie.items():
            value = _parse_value(raw, f"variável {var_id}, período {period}")
            if value is not None:
                observations.append(Observation(period_to_date(period), value))
        found[var_id] = sorted(observations, key=lambda o: o.ref_date)

    missing = set(variaveis) - set(found)
    if missing:
        raise ValidationError(f"variáveis ausentes na resposta: {sorted(missing)}")
    return found


def parse_periods(body: bytes) -> dict[date, datetime]:
    """Data de divulgação/última modificação de cada período (campo `modificacao`)."""
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"resposta não é JSON: {exc}") from exc
    if not isinstance(payload, list) or not payload:
        raise ValidationError("lista de períodos vazia ou fora do formato")
    out: dict[date, datetime] = {}
    for item in payload:
        try:
            ref = period_to_date(item["id"])
            modified = datetime.strptime(item["modificacao"], "%d/%m/%Y").replace(tzinfo=TZ)
        except (KeyError, TypeError, ValueError) as exc:
            raise ValidationError(f"período fora do formato: {item!r}") from exc
        out[ref] = modified
    return out


@dataclass(frozen=True)
class ScheduledRelease:
    ref_date: date
    released_at: datetime


def parse_calendar(body: bytes, produto: int) -> list[ScheduledRelease]:
    """Divulgações agendadas de um produto no calendário oficial do IBGE."""
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"resposta não é JSON: {exc}") from exc
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        raise ValidationError("calendário sem lista de itens")
    out = []
    for item in items:
        if item.get("produto_id") != produto or item.get("tipo_id") != 1:
            continue  # só "Divulgação de Indicadores" do produto pedido
        try:
            released_at = datetime.strptime(item["data_divulgacao"], "%d/%m/%Y %H:%M:%S").replace(
                tzinfo=TZ
            )
            ref = date(int(item["ano_referencia_inicio"]), int(item["mes_referencia_inicio"]), 1)
        except (KeyError, TypeError, ValueError) as exc:
            raise ValidationError(f"item de calendário fora do formato: {item!r}") from exc
        out.append(ScheduledRelease(ref, released_at))
    return sorted(out, key=lambda r: r.released_at)
