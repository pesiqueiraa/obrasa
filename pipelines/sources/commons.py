"""Wikimedia Commons: retrato oficial de cada mandato (aba Governos).

O Commons guarda os retratos oficiais da Presidência com autor e licença (docs/05). O leitor
pede, numa chamada, os metadados de cada arquivo citado em config/governos.yaml: endereço da
miniatura, página do arquivo, licença, autor e título. A imagem não é copiada para o oBrasa:
a página a carrega do endereço do Commons, como as fotos das notícias (regra 7).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from pipelines import http
from pipelines.models import RawResponse, ValidationError

SOURCE_ID = "wikimedia_commons"
API = "https://commons.wikimedia.org/w/api.php"
LARGURA = 320
HOSTS = ("https://upload.wikimedia.org/", "https://thumb.wikimedia.org/")


@dataclass(frozen=True)
class Arquivo:
    titulo: str
    miniatura: str
    pagina: str
    licenca: str
    autor: str


def fetch(arquivos: list[str]) -> RawResponse:
    params = {
        "action": "query",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": str(LARGURA),
        "format": "json",
        "titles": "|".join(sorted(arquivos)),
    }
    return http.get(SOURCE_ID, API, params=params)


def _texto(meta: dict, chave: str) -> str:
    valor = meta.get(chave, {}).get("value", "")
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(valor))).strip()


def parse(body: bytes) -> dict[str, Arquivo]:
    """{título do arquivo: metadados}. Arquivo ausente no Commons fica fora do dicionário."""
    try:
        paginas = json.loads(body)["query"]["pages"].values()
    except (ValueError, KeyError) as exc:
        raise ValidationError(f"Commons: resposta sem query.pages ({exc})") from exc
    saida: dict[str, Arquivo] = {}
    for p in paginas:
        if "missing" in p or not p.get("imageinfo"):
            continue
        info = p["imageinfo"][0]
        meta = info.get("extmetadata", {})
        # sem os parâmetros utm_* que a API acrescenta
        miniatura = info.get("thumburl", "").split("?", 1)[0]
        if not miniatura.startswith(HOSTS):
            raise ValidationError(
                f"Commons: {p['title']} sem miniatura nos servidores do Wikimedia"
            )
        saida[p["title"]] = Arquivo(
            titulo=p["title"],
            miniatura=miniatura,
            pagina=info["descriptionurl"],
            licenca=_texto(meta, "LicenseShortName"),
            autor=_texto(meta, "Artist"),
        )
    return saida
