"""Proposições da Câmara dos Deputados (dados abertos v2). Ver docs/05.

GET https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=PEC,PLP,PL
    &keywords=imposto&dataInicio=AAAA-MM-DD&dataFim=AAAA-MM-DD&itens=100&pagina=N
GET https://dadosabertos.camara.leg.br/api/v2/proposicoes/{id}   (statusProposicao)

Testado em 07/11/2026: `dataInicio`/`dataFim` filtram proposições com tramitação no
período; `keywords` procura na ementa e na indexação.
"""

from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime

from pipelines import http
from pipelines.models import RawResponse, ValidationError

SOURCE_ID = "camara_proposicoes"
BASE = "https://dadosabertos.camara.leg.br/api/v2"
FICHA = "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao={id}"
ITENS = 100


@dataclass(frozen=True)
class Proposicao:
    id: int
    sigla_tipo: str
    numero: int
    ano: int
    ementa: str
    situacao: str | None
    orgao: str | None
    ultima_tramitacao: datetime | None

    @property
    def url(self) -> str:
        return FICHA.format(id=self.id)


def _json(body: bytes, onde: str) -> dict:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"Câmara ({onde}): resposta não é JSON: {exc}") from exc
    if not isinstance(payload, dict) or "dados" not in payload:
        raise ValidationError(f"Câmara ({onde}): resposta sem 'dados'")
    return payload


def fetch_lista(tipos: list[str], termo: str, inicio: date, fim: date, pagina: int) -> RawResponse:
    params = {
        "siglaTipo": ",".join(tipos),
        "keywords": termo,
        "dataInicio": inicio.isoformat(),
        "dataFim": fim.isoformat(),
        "ordem": "DESC",
        "ordenarPor": "id",
        "itens": str(ITENS),
        "pagina": str(pagina),
    }
    return http.get(
        SOURCE_ID, f"{BASE}/proposicoes", params=params, headers={"Accept": "application/json"}
    )


def sem_acento(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()


def parse_lista(body: bytes, termos: list[str]) -> tuple[list[int], bool]:
    """Ids da página com um dos termos na ementa, e se há página seguinte.

    A busca da API também olha a indexação, que traz projetos só com incentivo fiscal de
    passagem (testado em 07/11/2026: metade dos 30 mais recentes). Exigir o termo na
    ementa deixa na lista só o que a própria ementa diz ser sobre tributo."""
    payload = _json(body, "lista")
    alvos = [sem_acento(t) for t in termos]
    try:
        ids = [
            int(it["id"])
            for it in payload["dados"]
            if any(t in sem_acento(str(it["ementa"])) for t in alvos)
        ]
    except (KeyError, TypeError, ValueError) as exc:
        raise ValidationError("Câmara: item da lista sem id ou ementa") from exc
    tem_proxima = any(link.get("rel") == "next" for link in payload.get("links", []))
    return ids, tem_proxima


def fetch_detalhe(id_: int) -> RawResponse:
    return http.get(SOURCE_ID, f"{BASE}/proposicoes/{id_}", headers={"Accept": "application/json"})


def parse_detalhe(body: bytes) -> Proposicao:
    d = _json(body, "detalhe")["dados"]
    try:
        status = d.get("statusProposicao") or {}
        quando = status.get("dataHora")
        return Proposicao(
            id=int(d["id"]),
            sigla_tipo=str(d["siglaTipo"]),
            numero=int(d["numero"]),
            ano=int(d["ano"]),
            ementa=" ".join(str(d["ementa"]).split()),
            situacao=status.get("descricaoSituacao"),
            orgao=status.get("siglaOrgao"),
            ultima_tramitacao=datetime.fromisoformat(quando) if quando else None,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ValidationError(f"Câmara: detalhe fora do formato: {exc}") from exc
