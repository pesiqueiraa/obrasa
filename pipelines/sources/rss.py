"""Leitura de feeds RSS 2.0 e Atom dos veículos (config/noticias.yaml). Ver docs/05.

Regra 7 do AGENTS.md: de cada item só saem título, link, data e um trecho curto da
descrição do feed. Corpo da matéria (content:encoded) e imagens não são lidos.
O XML vem de terceiros, por isso é lido com defusedxml (sem entidades externas).
"""

from __future__ import annotations

import html
import re
import urllib.robotparser
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from defusedxml import ElementTree as ET

from pipelines import http
from pipelines.models import RawResponse, ValidationError

SOURCE_ID = "rss_veiculos"
_ATOM = "{http://www.w3.org/2005/Atom}"
_TAG = re.compile(r"<[^>]+>")
_ESPACO = re.compile(r"\s+")
_RASTREIO = re.compile(r"^(utm_|at_|fbclid$|gclid$|mc_)")
_PREFIXO_USADO = re.compile(rb"<([A-Za-z][\w.-]*):[A-Za-z]")
_PATROCINADO = ("especial-publicitario", "publieditorial", "conteudo-patrocinado", "patrocinado")


def permitido(url: str, client: httpx.Client | None = None) -> bool:
    """O robots.txt do domínio permite que o agente do oBrasa leia `url`?"""
    parts = urlsplit(url)
    own = client is None
    client = client or httpx.Client(timeout=20, headers={"User-Agent": http.USER_AGENT})
    try:
        r = client.get(f"{parts.scheme}://{parts.netloc}/robots.txt", follow_redirects=True)
    finally:
        if own:
            client.close()
    if r.status_code >= 400:  # sem robots.txt: tudo permitido
        return True
    rp = urllib.robotparser.RobotFileParser()
    rp.parse(r.text.splitlines())
    return rp.can_fetch(http.USER_AGENT.split("/")[0], url)


def fetch(url: str) -> RawResponse:
    return http.get(SOURCE_ID, url, expect_json=False, timeout=30)


@dataclass(frozen=True)
class Item:
    url: str
    titulo: str
    publicado_em: datetime
    trecho: str | None
    imagem: str | None = None  # endereço da imagem de destaque dada pelo feed; nunca copiada


_IMG_TAG = re.compile(r"<img\b[^>]*>", re.I)
_IMG_SRC = re.compile(r"""src=["'](https?://[^"']+)["']""", re.I)
_PIXEL = re.compile(r"""\b1px\b|(width|height)=["']?1["'\s>]""", re.I)
_IMG_TEXTO = ("imagem-destaque", "image")  # elemento cujo texto é o endereço (Agência Brasil)
_EXT_IMG = re.compile(r"\.(jpe?g|png|webp|gif|avif)(\?|$)", re.I)


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def imagens(elem: ET.Element, desc: str | None) -> list[str]:
    """Imagem que o próprio feed associa à matéria: media:content / media:thumbnail (em
    qualquer namespace, inclusive o declarado à força), enclosure de imagem, link
    rel=enclosure (Atom) ou <img> da descrição. Só https, em ordem de preferência."""
    candidatos: list[str] = []
    for f in elem.iter():
        nome = _local(f.tag) if isinstance(f.tag, str) else ""
        if nome in _IMG_TEXTO and (f.text or "").strip().startswith("http"):
            candidatos.append(f.text.strip())
            continue
        url = f.get("url") or (f.get("href") if nome == "link" else None)
        if not url:
            continue
        tipo = (f.get("type") or f.get("medium") or "").lower()
        if (
            (
                nome in ("content", "thumbnail")
                and ("image" in tipo or (not tipo and _EXT_IMG.search(url)) or nome == "thumbnail")
            )
            or (nome == "enclosure" and ("image" in tipo or _EXT_IMG.search(url)))
            or (nome == "link" and f.get("rel") == "enclosure" and "image" in tipo)
        ):
            candidatos.append(url)
    if desc:
        for tag in _IMG_TAG.findall(desc):
            m = _IMG_SRC.search(tag)
            if m and not _PIXEL.search(tag):  # pixel de contagem de acesso não é foto
                candidatos.append(m.group(1))
    out = []
    for c in candidatos:
        c = c.strip().replace("&amp;", "&")
        if c.startswith("http://"):
            c = "https://" + c[7:]
        # BBC manda a miniatura de 240px; o mesmo servidor entrega 800px pelo caminho.
        c = c.replace("/ace/ws/240/", "/ace/ws/800/")
        if c.startswith("https://") and len(c) <= 1000 and "logo" not in c.lower() and c not in out:
            out.append(c)
    return out


def limpa_url(url: str) -> str:
    """Tira parâmetros de rastreamento e o fragmento, para a mesma matéria não entrar duas vezes.
    Links de contagem de cliques no formato ".../redir/...*https://destino" viram o destino."""
    url = url.strip()
    if "*http" in url:
        url = url[url.index("*http") + 1 :]
    p = urlsplit(url)
    query = urlencode([(k, v) for k, v in parse_qsl(p.query) if not _RASTREIO.match(k)])
    return urlunsplit((p.scheme, p.netloc.lower(), p.path, query, ""))


def texto(fragmento: str | None) -> str:
    """HTML do feed em texto simples, numa linha."""
    if not fragmento:
        return ""
    return _ESPACO.sub(" ", html.unescape(_TAG.sub(" ", html.unescape(fragmento)))).strip()


def corta(s: str, limite: int) -> str | None:
    """Trecho de até `limite` caracteres, cortado em fim de palavra, com reticências."""
    if not s:
        return None
    if len(s) <= limite:
        return s
    corte = s[: limite - 1].rsplit(" ", 1)[0].rstrip(",;:.-–— ")
    return corte + "…"


def _data(s: str | None) -> datetime | None:
    if not s:
        return None
    s = s.strip()
    try:
        d = parsedate_to_datetime(s)  # RSS: RFC 822
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))  # Atom: ISO 8601
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=UTC)


def _no_dominio(url: str, dominio: str) -> bool:
    host = urlsplit(url).netloc.lower().split(":")[0]
    return host == dominio or host.endswith("." + dominio)


def _declara_prefixos(body: bytes) -> bytes:
    """Alguns feeds usam prefixos sem declará-los (ex.: <media:content> sem xmlns:media).
    Declara os que faltam na raiz, com um namespace neutro, para o XML poder ser lido.
    Esses elementos não são usados."""
    usados = {p.decode() for p in _PREFIXO_USADO.findall(body)} - {"xml"}
    faltam = [p for p in sorted(usados) if f"xmlns:{p}=".encode() not in body]
    if not faltam:
        return body
    decl = " ".join(f'xmlns:{p}="urn:obrasa:sem-declaracao:{p}"' for p in faltam)
    return re.sub(rb"<(rss|feed)\b", lambda m: m.group(0) + b" " + decl.encode(), body, count=1)


def _xml(body: bytes, content_type: str | None) -> bytes:
    """Feed sem declaração XML vem na codificação do cabeçalho HTTP (UOL: ISO-8859-1)."""
    inicio = body.lstrip()[:5]
    m = re.search(r"charset=([\w-]+)", content_type or "")
    if inicio != b"<?xml" and m and m.group(1).lower() not in ("utf-8", "utf8"):
        body = b'<?xml version="1.0" encoding="utf-8"?>' + body.decode(m.group(1)).encode()
    return _declara_prefixos(body)


def parse(
    body: bytes, dominio: str, trecho_max: int, content_type: str | None = None
) -> list[Item]:
    """Itens do feed com link no domínio do veículo. Item sem título, link ou data é ignorado,
    assim como conteúdo publicitário; feed sem nenhum item válido é erro (ValidationError)."""
    try:
        root = ET.fromstring(_xml(body, content_type))
    except (ET.ParseError, UnicodeDecodeError, LookupError) as exc:
        raise ValidationError(f"feed não é XML válido: {exc}") from exc
    if root.tag == "rss" or root.find("channel") is not None:
        brutos = [
            (
                i.findtext("title"),
                i.findtext("link"),
                i.findtext("pubDate") or i.findtext("{http://purl.org/dc/elements/1.1/}date"),
                i.findtext("description"),
                i,
            )
            for i in root.iter("item")
        ]
    elif root.tag == f"{_ATOM}feed":
        brutos = []
        for e in root.iter(f"{_ATOM}entry"):
            link = next(
                (
                    a.get("href")
                    for a in e.findall(f"{_ATOM}link")
                    if a.get("rel", "alternate") == "alternate"
                ),
                None,
            )
            brutos.append(
                (
                    e.findtext(f"{_ATOM}title"),
                    link,
                    e.findtext(f"{_ATOM}published") or e.findtext(f"{_ATOM}updated"),
                    e.findtext(f"{_ATOM}summary"),
                    e,
                )
            )
    else:
        raise ValidationError(f"feed em formato desconhecido: <{root.tag}>")

    # Imagem repetida em vários itens (logotipo do veículo) não é foto da matéria.
    por_item = [imagens(b[4], b[3]) for b in brutos]
    contagem = Counter(c for cs in por_item for c in cs)
    repetidas = {c for c, k in contagem.items() if k >= 3}
    itens = []
    for (titulo, link, data, desc, _), cands in zip(brutos, por_item, strict=True):
        titulo_t = texto(titulo)
        quando = _data(data)
        if not titulo_t or not link or not quando:
            continue
        url = limpa_url(link)
        if not url.startswith("https://") and not url.startswith("http://"):
            continue
        if not _no_dominio(url, dominio):
            continue  # link para fora do veículo: não é matéria dele
        if any(p in url for p in _PATROCINADO):
            continue  # publicidade, não notícia
        resumo = texto(desc)
        if resumo.casefold() == titulo_t.casefold():
            resumo = ""
        itens.append(
            Item(
                url,
                titulo_t,
                quando.astimezone(UTC),
                corta(resumo, trecho_max),
                next((c for c in cands if c not in repetidas), None),
            )
        )
    if not itens:
        raise ValidationError(f"nenhum item válido do domínio {dominio} no feed")
    return itens
