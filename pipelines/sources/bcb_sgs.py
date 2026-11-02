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
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from pipelines import http
from pipelines.models import Descricao, Observation, RawResponse, ValidationError

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


# Webservice SOAP do SGS (docs/05): nome, unidade, periodicidade e último valor da série.
# É um serviço diferente da API JSON, então serve também para conferir o último valor.
WSSGS = "https://www3.bcb.gov.br/wssgs/services/FachadaWSSGS"
_ENVELOPE = (
    '<?xml version="1.0"?><soapenv:Envelope '
    'xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
    'xmlns:pub="http://publico.ws.casosdeuso.sgs.pec.bcb.gov.br"><soapenv:Body>'
    "<pub:getUltimoValorXML><in0>{codigo}</in0></pub:getUltimoValorXML>"
    "</soapenv:Body></soapenv:Envelope>"
)
_VALOR_BR = re.compile(r"^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$")


def fetch_metadata(codigo: int) -> RawResponse:
    return http.post(
        SOURCE_ID,
        WSSGS,
        content=_ENVELOPE.format(codigo=int(codigo)).encode(),
        headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": "getUltimoValorXML"},
    )


def parse_metadata(body: bytes, codigo: int) -> tuple[Descricao, date, Decimal]:
    """Descrição da série e último valor (data, valor) segundo o webservice."""
    try:
        envelope = ET.fromstring(body)
        retorno = next(e for e in envelope.iter() if e.tag.endswith("getUltimoValorXMLReturn"))
        interno = re.sub(r"^<\?xml[^>]*\?>", "", (retorno.text or "").strip())
        resposta = ET.fromstring(interno)
    except (ET.ParseError, StopIteration) as exc:
        raise ValidationError(f"webservice SGS fora do formato: {exc}") from exc
    if resposta.get("status") != "2":
        raise ValidationError(f"webservice SGS: {resposta.get('descricao')!r}")
    serie = resposta.find("SERIE")

    def campo(nome: str) -> str:
        el = serie.find(nome) if serie is not None else None
        if el is None or el.text is None:
            raise ValidationError(f"webservice SGS sem o campo {nome}")
        return el.text.strip()

    if campo("CODIGO") != str(codigo):
        raise ValidationError(f"webservice SGS respondeu a série {campo('CODIGO')}, não {codigo}")
    valor = campo("VALOR")
    if not _VALOR_BR.match(valor):
        raise ValidationError(f"webservice SGS: valor fora do formato {valor!r}")
    try:
        ref = date(int(campo("DATA/ANO")), int(campo("DATA/MES")), int(campo("DATA/DIA")))
    except ValueError as exc:
        raise ValidationError(f"webservice SGS: data inválida: {exc}") from exc
    descricao = Descricao(
        nome=campo("NOME"), unidade=campo("UNIDADE"), periodicidade=campo("PERIODICIDADE")
    )
    return descricao, ref, Decimal(valor.replace(".", "").replace(",", "."))
