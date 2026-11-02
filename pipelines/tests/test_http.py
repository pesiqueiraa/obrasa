import httpx

from pipelines import http

HTML = b"<html><title>Requisicao invalida!</title></html>"
JSON = b'[{"data":"01/09/2026","valor":"4.58"}]'


def client_with(responses: list[httpx.Response]) -> httpx.Client:
    queue = iter(responses)
    return httpx.Client(transport=httpx.MockTransport(lambda request: next(queue)))


def test_html_with_200_is_retried_until_json():
    client = client_with(
        [
            httpx.Response(200, content=HTML, headers={"content-type": "text/html"}),
            httpx.Response(200, content=JSON, headers={"content-type": "application/json"}),
        ]
    )
    raw = http.get("bcb_sgs", "https://example.test", client=client, sleep=lambda _: None)
    assert raw.body == JSON


def test_last_non_json_response_is_returned_for_raw_storage():
    client = client_with(
        [httpx.Response(200, content=HTML, headers={"content-type": "text/html"})] * 2
    )
    raw = http.get(
        "bcb_sgs", "https://example.test", attempts=2, client=client, sleep=lambda _: None
    )
    assert raw.body == HTML
    assert raw.content_type == "text/html"


def test_server_error_retried():
    client = client_with(
        [
            httpx.Response(503),
            httpx.Response(200, content=JSON, headers={"content-type": "application/json"}),
        ]
    )
    raw = http.get("bcb_sgs", "https://example.test", client=client, sleep=lambda _: None)
    assert raw.body == JSON
