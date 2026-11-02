"""Cliente HTTP comum: timeout, novas tentativas e identificação do projeto."""

from __future__ import annotations

import os
import time
from datetime import UTC, datetime

import httpx

from pipelines.models import RawResponse

USER_AGENT = "oBrasa/0.1 (dados publicos; +https://github.com/)"
RETRY_STATUS = {429, 500, 502, 503, 504}

# A API do IBGE recusa conexões de fora do Brasil, e o GitHub Actions roda nos EUA. Com
# IBGE_PONTE_URL e IBGE_PONTE_TOKEN definidas, os pedidos a ela passam pela ponte em São
# Paulo (apps/web/src/lib/ponte.ts), que repassa o corpo sem mudar. A resposta bruta
# guarda a URL do IBGE, nunca a da ponte. Sem as variáveis (máquina local), vai direto.
ORIGEM_IBGE = "https://servicodados.ibge.gov.br/api/"


def ponte_ibge() -> tuple[str, str] | None:
    url, token = os.environ.get("IBGE_PONTE_URL", ""), os.environ.get("IBGE_PONTE_TOKEN", "")
    return (url.rstrip("/") + "/", token) if url and token else None


def destino(url: str, ponte: tuple[str, str] | None) -> tuple[str, dict[str, str]]:
    """URL a pedir e cabeçalhos extras: pela ponte só quando a URL é da API do IBGE."""
    if ponte and url.startswith(ORIGEM_IBGE):
        return ponte[0] + url[len(ORIGEM_IBGE) :], {"x-ponte-token": ponte[1]}
    return url, {}


def url_de_origem(pedida: str, ponte: tuple[str, str] | None) -> str:
    if ponte and pedida.startswith(ponte[0]):
        return ORIGEM_IBGE + pedida[len(ponte[0]) :]
    return pedida


def get(
    source_id: str,
    url: str,
    *,
    params: dict[str, str] | None = None,
    **kwargs,
) -> RawResponse:
    return request(source_id, "GET", url, params=params, **kwargs)


def post(
    source_id: str, url: str, *, content: bytes, headers: dict[str, str], **kwargs
) -> RawResponse:
    """POST (webservice SOAP do SGS). Mesmas tentativas e garantias do GET."""
    kwargs.setdefault("expect_json", False)
    return request(source_id, "POST", url, content=content, headers=headers, **kwargs)


def request(
    source_id: str,
    method: str,
    url: str,
    *,
    params: dict[str, str] | None = None,
    content: bytes | None = None,
    headers: dict[str, str] | None = None,
    attempts: int = 4,
    timeout: float = 60.0,
    expect_json: bool = True,
    client: httpx.Client | None = None,
    sleep=time.sleep,
) -> RawResponse:
    """Requisição com até `attempts` tentativas e espera crescente. Falha com exceção, nunca em silêncio.

    Com `expect_json`, uma resposta 200 que não é JSON (o SGS às vezes devolve uma
    página HTML "Requisição inválida!" com status 200) também gera nova tentativa.
    Se a última tentativa ainda não for JSON, ela é devolvida assim mesmo: o
    chamador guarda a resposta bruta e o parser falha com ValidationError.
    """
    own_client = client is None
    # Conexão que não abre em 15 s não vai abrir: falha logo em vez de esperar o timeout todo.
    client = client or httpx.Client(
        timeout=httpx.Timeout(timeout, connect=min(15.0, timeout)),
        headers={"User-Agent": USER_AGENT},
    )
    ponte = ponte_ibge()
    url, extras = destino(url, ponte)
    if extras:
        headers = {**(headers or {}), **extras}
    last_error: Exception | None = None
    try:
        for attempt in range(1, attempts + 1):
            try:
                response = client.request(
                    method, url, params=params, content=content, headers=headers
                )
                if response.status_code in RETRY_STATUS and attempt < attempts:
                    sleep(2**attempt)
                    continue
                response.raise_for_status()
                is_json = "json" in response.headers.get("content-type", "")
                if expect_json and not is_json and attempt < attempts:
                    sleep(2 ** (attempt + 1))
                    continue
                return RawResponse(
                    source_id=source_id,
                    url=url_de_origem(str(response.url), ponte),
                    body=response.content,
                    content_type=response.headers.get("content-type", "application/json"),
                    fetched_at=datetime.now(UTC),
                )
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                last_error = exc
                if attempt < attempts:
                    sleep(2**attempt)
        raise RuntimeError(f"{source_id}: falha ao buscar {url}: {last_error}") from last_error
    finally:
        if own_client:
            client.close()
