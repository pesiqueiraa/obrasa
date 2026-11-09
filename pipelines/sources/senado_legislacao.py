"""Senado Federal: lista de emendas à Constituição e leis complementares (aba Governos, bloco 4).

`GET https://legis.senado.leg.br/dadosabertos/legislacao/lista?tipo=EMC|LCP&ano=AAAA`
devolve, por norma, número, data de assinatura, nome e ementa oficial. O leitor exige o
tipo esperado (EMC-n ou LCP) e datas válidas; `confere` exige numeração sem buraco nem
repetição, para não gravar lista incompleta (falha fechada).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime
from itertools import pairwise

from pipelines import http
from pipelines.models import RawResponse, ValidationError

SOURCE_ID = "senado_legislacao"
URL = "https://legis.senado.leg.br/dadosabertos/legislacao/lista"
TIPOS = {"EMC": "EMC-n", "LCP": "LCP"}
URN = {"EMC": "emenda.constitucional", "LCP": "lei.complementar"}


@dataclass(frozen=True)
class Norma:
    tipo: str  # EMC ou LCP
    numero: int
    data: date
    nome: str
    ementa: str

    @property
    def url(self) -> str:
        return f"https://normas.leg.br/?urn=urn:lex:br:federal:{URN[self.tipo]}:{self.data.isoformat()};{self.numero}"


def fetch(tipo: str, ano: int) -> RawResponse:
    return http.get(
        SOURCE_ID,
        URL,
        params={"tipo": tipo, "ano": str(ano)},
        headers={"Accept": "application/json"},
    )


def parse(body: bytes, tipo: str, ano: int) -> list[Norma]:
    try:
        lista = json.loads(body)["ListaDocumento"]
    except (ValueError, KeyError) as exc:
        raise ValidationError(f"Senado {tipo} {ano}: resposta sem ListaDocumento ({exc})") from exc
    docs = (lista.get("documentos") or {}).get("documento", [])
    if isinstance(docs, dict):
        docs = [docs]
    normas = []
    for d in docs:
        if d.get("tipo") != TIPOS[tipo]:
            raise ValidationError(f"Senado {tipo} {ano}: tipo inesperado {d.get('tipo')!r}")
        data = datetime.strptime(d["dataassinatura"], "%d/%m/%Y").date()
        if data.year != ano:
            raise ValidationError(f"Senado {tipo} {ano}: {d['normaNome']} assinada em {data}")
        ementa = " ".join(str(d.get("ementa") or "").split())
        if not ementa:
            raise ValidationError(f"Senado {tipo} {ano}: {d['normaNome']} sem ementa")
        normas.append(Norma(tipo, int(d["numero"]), data, d["normaNome"], ementa))
    return normas


def confere(normas: list[Norma]) -> list[str]:
    """Numeração de cada tipo sem buraco nem repetição, e crescente com a data."""
    motivos: list[str] = []
    for tipo in TIPOS:
        do_tipo = sorted((n for n in normas if n.tipo == tipo), key=lambda n: n.numero)
        if not do_tipo:
            motivos.append(f"{tipo}: nenhuma norma")
            continue
        for a, b in pairwise(do_tipo):
            if b.numero == a.numero:
                motivos.append(f"{tipo} {b.numero}: repetida")
            elif b.numero != a.numero + 1:
                motivos.append(f"{tipo}: falta entre {a.numero} e {b.numero}")
            elif b.data < a.data:
                motivos.append(f"{tipo} {b.numero}: data {b.data} antes da {a.numero} ({a.data})")
    return motivos
