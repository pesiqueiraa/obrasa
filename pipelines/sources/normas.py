"""Texto das leis no normas.leg.br (Senado Federal, LexML). Ver docs/05.

GET https://normas.leg.br/api/public/normas?urn=<URN da norma>&tipo_documento=maior-detalhe

Testado em 07/11/2026: JSON-LD (schema.org) com a norma inteira, licença CC-BY 4.0. Cada
dispositivo (artigo, parágrafo, inciso, alínea) é um nó com `legislationIdentifier`
(`<URN da norma>!art125_par4`, às vezes com sufixo da norma que o incluiu, como
`,emc-132-2023-12-20`) e uma ou mais versões em `workExample`, cada uma com
`legislationDate` e `text`. O texto compilado (com as alterações) existe para a LC 214, a
Constituição e o ADCT. A Lei 9.250/1995 vem sem texto estruturado: os artigos incluídos
pela Lei 15.270/2025 são lidos no texto da própria Lei 15.270 (`!art2_cpt_alt1_art3-1`).

O Planalto (planalto.gov.br) recusa conexões de programas; o link mostrado ao leitor
continua sendo o do Planalto, e a conferência automática lê o texto daqui.
"""

from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass

from pipelines import http
from pipelines.models import RawResponse, ValidationError

SOURCE_ID = "normas_leg"
API = "https://normas.leg.br/api/public/normas"
PAGINA = "https://normas.leg.br/?urn={urn}"


@dataclass(frozen=True)
class Dispositivo:
    urn: str  # sem a marca de versão (@data)
    rotulo: str  # "Art. 128.", "I –", "a)" ou "" no caput
    data_versao: str  # AAAA-MM-DD da versão mais recente
    texto: str  # texto puro da versão mais recente


def norma_de(urn_dispositivo: str) -> str:
    """URN da norma a partir da URN de um dispositivo (parte antes do `!`)."""
    if "!" not in urn_dispositivo:
        raise ValueError(f"URN sem dispositivo: {urn_dispositivo}")
    return urn_dispositivo.split("!", 1)[0]


def fetch(urn_norma: str) -> RawResponse:
    return http.get(
        SOURCE_ID,
        API,
        params={"urn": urn_norma, "tipo_documento": "maior-detalhe"},
        headers={"Accept": "application/json"},
    )


def _limpa(texto: str) -> str:
    sem_tags = re.sub(r"<[^>]+>", " ", texto)
    return re.sub(r"\s+", " ", html.unescape(sem_tags)).strip()


def _nos(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from _nos(v)
    elif isinstance(o, list):
        for v in o:
            yield from _nos(v)


def _pertence(urn: str, prefixo: str) -> bool:
    """O dispositivo `urn` está dentro de `prefixo`? `!art12` não pega `!art128`."""
    if not urn.startswith(prefixo):
        return False
    resto = urn[len(prefixo) :]
    return resto == "" or resto[0] in "_,"


def parse(body: bytes, urn_norma: str) -> list[Dispositivo]:
    """Todos os dispositivos com texto, na versão mais recente de cada um, na ordem do texto."""
    try:
        d = json.loads(body)
    except ValueError as exc:
        raise ValidationError(f"normas.leg.br: resposta não é JSON ({exc})") from exc
    if not isinstance(d, dict) or d.get("legislationIdentifier") != urn_norma:
        raise ValidationError(f"normas.leg.br: resposta não é a norma {urn_norma}")
    por_urn: dict[str, Dispositivo] = {}
    for no in _nos(d):
        urn = no.get("legislationIdentifier")
        exemplos = no.get("workExample")
        # Nó do dispositivo: URN sem marca de versão (@data). As versões ficam em workExample.
        if not isinstance(urn, str) or "!" not in urn or "@" in urn or exemplos is None:
            continue
        versoes = [
            e
            for e in (exemplos if isinstance(exemplos, list) else [exemplos])
            if isinstance(e, dict) and isinstance(e.get("text"), str)
        ]
        if not versoes:
            continue
        ultima = max(versoes, key=lambda e: e.get("legislationDate") or "")
        por_urn[urn] = Dispositivo(
            urn=urn,
            rotulo=_limpa(ultima.get("name") or ""),
            data_versao=ultima.get("legislationDate") or "",
            texto=_limpa(ultima["text"]),
        )
    if not por_urn:
        raise ValidationError(f"normas.leg.br: {urn_norma} sem nenhum dispositivo com texto")
    return list(por_urn.values())


def trecho(dispositivos: list[Dispositivo], prefixo: str) -> list[Dispositivo]:
    """Os dispositivos dentro de `prefixo` (ex.: `<norma>!art125`), na ordem do texto."""
    achados = [d for d in dispositivos if _pertence(d.urn, prefixo)]
    if not achados:
        raise ValidationError(f"normas.leg.br: dispositivo {prefixo} não encontrado")
    return achados


def texto_corrido(dispositivos: list[Dispositivo]) -> str:
    """Texto do trecho, um dispositivo por linha, com o rótulo (`Art. 128.`, `I –`)."""
    return "\n".join(f"{d.rotulo} {d.texto}".strip() for d in dispositivos)
