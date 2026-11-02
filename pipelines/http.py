"""Cliente HTTP comum: timeout, novas tentativas e identificação do projeto."""

from __future__ import annotations

import time
from datetime import UTC, datetime

import httpx

from pipelines.models import RawResponse

USER_AGENT = "oBrasa/0.1 (dados publicos; +https://github.com/)"
RETRY_STATUS = {429, 500, 502, 503, 504}


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
    client = client or httpx.Client(timeout=timeout, headers={"User-Agent": USER_AGENT})
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
                    url=str(response.url),
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
