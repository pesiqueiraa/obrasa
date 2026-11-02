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
from typing import Literal
from zoneinfo import ZoneInfo

from pipelines import http
from pipelines.models import Observation, RawResponse, ValidationError

SOURCE_ID = "ibge_agregados"
BASE = "https://servicodados.ibge.gov.br/api/v3"
MISSING = {"...", "-", "..", "X", ""}
TZ = ZoneInfo("America/Sao_Paulo")
_PERIOD = re.compile(r"^(\d{4})(\d{2})$")
_CLASSIFICACAO = re.compile(r"^(\d+)\[(\d+)\]$")

# Como ler o código de período AAAANN de cada tabela:
#   mensal e trimestral_movel: NN é o mês (no trimestre móvel, o mês final);
#   trimestral: NN é o trimestre (01 a 04), guardado no 1º mês do trimestre.
TipoPeriodo = Literal["mensal", "trimestral_movel", "trimestral"]


def fetch_variables(
    tabela: int, variaveis: list[int], periodos: str, classificacao: str | None = None
) -> RawResponse:
    """Busca as variáveis da tabela para o Brasil (N1).

    `periodos` aceita intervalo ("197912-202609"), lista ("202608|202609")
    ou os últimos N períodos ("-N"). `classificacao` filtra uma categoria,
    no formato da API: "11255[90707]".
    """
    vars_ = "|".join(str(v) for v in variaveis)
    url = f"{BASE}/agregados/{tabela}/periodos/{periodos}/variaveis/{vars_}"
    params = {"localidades": "N1[all]"}
    if classificacao:
        if not _CLASSIFICACAO.match(classificacao):
            raise ValueError(f"classificação fora do formato id[categoria]: {classificacao!r}")
        params["classificacao"] = classificacao
    return http.get(SOURCE_ID, url, params=params)


def fetch_periods(tabela: int) -> RawResponse:
    return http.get(SOURCE_ID, f"{BASE}/agregados/{tabela}/periodos")


def fetch_calendar(produto: int, de: date, ate: date) -> RawResponse:
    params = {"de": de.strftime("%m-%d-%Y"), "ate": ate.strftime("%m-%d-%Y")}
    return http.get(SOURCE_ID, f"{BASE}/calendario/{produto}", params=params)


def period_to_date(period: str, tipo: TipoPeriodo = "mensal") -> date:
    m = _PERIOD.match(period)
    if not m:
        raise ValidationError(f"período fora do formato AAAANN: {period!r}")
    year, n = int(m.group(1)), int(m.group(2))
    if tipo == "trimestral":
        if not 1 <= n <= 4:
            raise ValidationError(f"trimestre inválido no período {period!r}")
        return date(year, (n - 1) * 3 + 1, 1)
    if not 1 <= n <= 12:
        raise ValidationError(f"mês inválido no período {period!r}")
    return date(year, n, 1)


def date_to_period(d: date, tipo: TipoPeriodo = "mensal") -> str:
    if tipo == "trimestral":
        if d.day != 1 or (d.month - 1) % 3:
            raise ValueError(f"data {d} não é o 1º dia de um trimestre")
        return f"{d.year:04d}{(d.month - 1) // 3 + 1:02d}"
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


def _check_classificacao(resultado: dict, classificacao: str | None, var_id: int) -> None:
    got = resultado.get("classificacoes") or []
    if classificacao is None:
        if got:
            raise ValidationError(f"variável {var_id}: classificação inesperada na resposta")
        return
    m = _CLASSIFICACAO.match(classificacao)
    if not m:
        raise ValueError(f"classificação fora do formato id[categoria]: {classificacao!r}")
    cid, cat = m.groups()
    if (
        len(got) != 1
        or str(got[0].get("id")) != cid
        or list((got[0].get("categoria") or {}).keys()) != [cat]
    ):
        raise ValidationError(f"variável {var_id}: esperada só a classificação {classificacao}")


def parse_variables(
    body: bytes,
    variaveis: list[int],
    *,
    classificacao: str | None = None,
    tipo: TipoPeriodo = "mensal",
) -> dict[int, list[Observation]]:
    """Converte a resposta em observações por variável, validando o layout.

    Falha (ValidationError) se faltar variável, se vier localidade diferente de Brasil,
    se a classificação não for a pedida ou se houver valor fora do formato. Valores
    marcados como ausentes pela fonte ("...", "-") são omitidos, nunca convertidos em zero.
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
        if len(resultados) != 1:
            raise ValidationError(f"variável {var_id}: esperado 1 resultado")
        _check_classificacao(resultados[0], classificacao, var_id)
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
                observations.append(Observation(period_to_date(period, tipo), value))
        found[var_id] = sorted(observations, key=lambda o: o.ref_date)

    missing = set(variaveis) - set(found)
    if missing:
        raise ValidationError(f"variáveis ausentes na resposta: {sorted(missing)}")
    return found


def parse_periods(body: bytes, tipo: TipoPeriodo = "mensal") -> dict[date, datetime]:
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
            ref = period_to_date(item["id"], tipo)
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
