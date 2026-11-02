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


def test_ibge_pela_ponte_guarda_a_url_do_ibge(monkeypatch):
    monkeypatch.setenv("IBGE_PONTE_URL", "https://obrasa.vercel.app/api/ponte-ibge")
    monkeypatch.setenv("IBGE_PONTE_TOKEN", "t" * 40)
    pedidos = []

    def responde(request):
        pedidos.append(request)
        return httpx.Response(200, content=JSON, headers={"content-type": "application/json"})

    client = httpx.Client(transport=httpx.MockTransport(responde))
    raw = http.get(
        "ibge_agregados",
        "https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/-1/variaveis/63",
        params={"localidades": "N1[all]"},
        client=client,
    )
    assert str(pedidos[0].url).startswith(
        "https://obrasa.vercel.app/api/ponte-ibge/v3/agregados/1737/periodos/-1/variaveis/63?"
    )
    assert pedidos[0].headers["x-ponte-token"] == "t" * 40
    assert raw.url.startswith("https://servicodados.ibge.gov.br/api/v3/agregados/1737/")
    assert "ponte" not in raw.url and "localidades=" in raw.url
    assert raw.body == JSON


def test_outras_fontes_e_maquina_local_vao_direto(monkeypatch):
    ponte = ("https://obrasa.vercel.app/api/ponte-ibge/", "t" * 40)
    assert http.destino("https://api.bcb.gov.br/dados/serie/x", ponte) == (
        "https://api.bcb.gov.br/dados/serie/x",
        {},
    )
    monkeypatch.delenv("IBGE_PONTE_URL", raising=False)
    monkeypatch.delenv("IBGE_PONTE_TOKEN", raising=False)
    assert http.ponte_ibge() is None
    assert http.destino("https://servicodados.ibge.gov.br/api/v3/x", None)[1] == {}
