"""Meta de inflação do CMN por ano, da página de histórico de metas do Banco Central.

GET https://www.bcb.gov.br/api/paginasite/sitebcb/controleinflacao/historicometas

Testado em 08/11/2026: JSON com o HTML da página em `conteudo` (a página do site é montada
a partir dele). Duas partes interessam:

  * a tabela "Histórico do regime de metas de inflação (1999–2024)": ano, norma, data,
    meta, tamanho do intervalo, intervalo de tolerância, inflação efetiva (IPCA) e carta
    aberta. Anos com duas resoluções (2003 e 2004) trazem dois valores na mesma célula,
    o da resolução mais recente primeiro; a nota "*" traz as metas ajustadas pela carta
    aberta de 21/1/2003. Norma e data de 1999 a 2001 vêm numa célula só (rowspan);
  * o parágrafo da meta contínua (desde 2025): "A meta, fixada pela Resolução CMN nº
    5.141, ..., é de 3,00%, com intervalo de tolerância de ±1,5 ponto percentual".

O parser recusa a resposta (falha fechada) se o cabeçalho da tabela mudar, se o intervalo
não for meta ± tamanho, ou se o parágrafo da meta contínua não estiver no formato.
"""

from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from decimal import Decimal

from pipelines import http
from pipelines.models import RawResponse, ValidationError

SOURCE_ID = "bcb_metas_inflacao"
API = "https://www.bcb.gov.br/api/paginasite/sitebcb/controleinflacao/historicometas"
PAGINA = "https://www.bcb.gov.br/controleinflacao/historicometas"
BASE = "https://www.bcb.gov.br"
INICIO_CONTINUA = 2025

CABECALHO = [
    "Ano", "Norma", "Data", "Meta (%)", "Tamanho do intervalo +/- (p.p.)",
    "Intervalo de tolerância (%)", "Inflação efetiva (Variação do IPCA, %)", "Carta Aberta",
]  # fmt: skip


@dataclass(frozen=True)
class Meta:
    ano: int
    continua: bool
    meta: Decimal
    tolerancia: Decimal
    inferior: Decimal
    superior: Decimal
    normas: tuple[str, ...]
    meta_original: Decimal | None = None
    meta_ajustada: Decimal | None = None
    nota: str | None = None
    ipca_efetivo: Decimal | None = None
    carta_aberta: bool | None = None
    carta_url: str | None = None


def fetch() -> RawResponse:
    return http.get(SOURCE_ID, API, headers={"Accept": "application/json"})


_ZW = re.compile("[​‌‍﻿]")


def _texto(fragmento: str) -> str:
    sem = re.sub(r"<[^>]+>", " ", fragmento)
    return re.sub(r"\s+", " ", _ZW.sub("", html.unescape(sem))).strip()


def _partes(celula: str) -> list[str]:
    """Valores de uma célula separados por <br>, sem os vazios."""
    return [t for t in (_texto(p) for p in re.split(r"<br\s*/?>", celula)) if t]


def _num(s: str) -> Decimal:
    if not re.fullmatch(r"-?\d+(,\d+)?", s):
        raise ValidationError(f"metas do BC: número fora do formato: {s!r}")
    return Decimal(s.replace(",", "."))


def _intervalo(s: str) -> tuple[Decimal, Decimal]:
    m = re.fullmatch(r"(\d+(?:,\d+)?)-(\d+(?:,\d+)?)", s)
    if not m:
        raise ValidationError(f"metas do BC: intervalo fora do formato: {s!r}")
    return _num(m.group(1)), _num(m.group(2))


def _celulas(tr: str) -> list[tuple[str, int]]:
    """(conteúdo, rowspan) de cada <td> da linha."""
    out = []
    for m in re.finditer(r"<td([^>]*)>(.*?)</td>", tr, re.S):
        rs = re.search(r"rowspan=\W*(\d+)", m.group(1))
        out.append((m.group(2), int(rs.group(1)) if rs else 1))
    return out


def _normas(celula: str) -> tuple[str, ...]:
    achadas = [_texto(a) for a in re.findall(r"<a[^>]*>(.*?)</a>", celula, re.S)]
    normas = tuple(a for a in achadas if a.startswith("Resolução"))
    for n in normas:
        if not re.fullmatch(r"Resolução CMN nº \d\.\d{3}", n):
            raise ValidationError(f"metas do BC: norma fora do formato: {n!r}")
    return normas


def _conteudo(body: bytes) -> str:
    try:
        conteudo = json.loads(body)["conteudo"]
    except (ValueError, KeyError, TypeError) as exc:
        raise ValidationError(f"metas do BC: resposta fora do formato ({exc})") from exc
    if not isinstance(conteudo, str):
        raise ValidationError("metas do BC: `conteudo` não é texto")
    # A tabela vem dentro de um atributo Angular, com as aspas escapadas (\&#34;).
    return conteudo.replace("\\&#34;", '"').replace("&#34;", '"')


def parse(body: bytes) -> list[Meta]:
    """Metas de 1999 a 2024, do ano mais recente para o mais antigo, como na página."""
    conteudo = _conteudo(body)
    titulo = re.search(
        r"Histórico do regime de metas de inflação(?:&nbsp;|\s)\(1999–2024\)", conteudo
    )
    i = titulo.start() if titulo else -1
    tabela = re.search(r"<table.*?</table>", conteudo[i:], re.S) if titulo else None
    if not tabela:
        raise ValidationError("metas do BC: tabela do histórico não encontrada")
    linhas = re.findall(r"<tr[^>]*>(.*?)</tr>", tabela.group(0), re.S)
    cab = [_texto(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", linhas[0], re.S)]
    if [re.sub(r"\s+", "", c) for c in cab] != [re.sub(r"\s+", "", c) for c in CABECALHO]:
        raise ValidationError(f"metas do BC: cabeçalho da tabela mudou: {cab}")

    ajustes, nota = _nota_ajuste(conteudo[i:])
    metas: list[Meta] = []
    herdadas: tuple[str, ...] = ()
    restam = 0  # linhas seguintes ainda cobertas pela célula de norma com rowspan
    for tr in linhas[1:]:
        cel = _celulas(tr)
        if len(cel) == 8:
            ano_c, norma_c, _data, meta_c, tam_c, int_c, ipca_c, carta_c = cel
            herdadas = _normas(norma_c[0])
            restam = norma_c[1] - 1
        elif len(cel) == 6 and restam > 0:
            ano_c, meta_c, tam_c, int_c, ipca_c, carta_c = cel
            restam -= 1
        else:
            raise ValidationError(f"metas do BC: linha com {len(cel)} colunas")
        ano_txt = _texto(ano_c[0])
        m = re.fullmatch(r"(\d{4})(\**)", ano_txt)
        if not m:
            raise ValidationError(f"metas do BC: ano fora do formato: {ano_txt!r}")
        ano = int(m.group(1))
        valores = [_num(v) for v in _partes(meta_c[0])]
        tamanhos = [_num(v) for v in _partes(tam_c[0])]
        intervalos = [_intervalo(v) for v in _partes(int_c[0])]
        if not (len(valores) == len(tamanhos) == len(intervalos)) or len(valores) not in (1, 2):
            raise ValidationError(
                f"metas do BC {ano}: número de metas, tamanhos e intervalos difere"
            )
        for v, t, (a, b) in zip(valores, tamanhos, intervalos, strict=True):
            if v - t != a or v + t != b:
                raise ValidationError(f"metas do BC {ano}: intervalo {a}-{b} não é {v} ± {t}")
        carta_txt = _texto(carta_c[0])
        carta_url = None
        if carta_txt.startswith("Sim"):
            href = re.search(r'href="([^"]+\.pdf)"', carta_c[0])
            if not href:
                raise ValidationError(f"metas do BC {ano}: carta aberta sem link")
            carta_url = BASE + href.group(1) if href.group(1).startswith("/") else href.group(1)
        elif carta_txt != "Não":
            raise ValidationError(f"metas do BC {ano}: carta aberta fora do formato: {carta_txt!r}")
        if m.group(2) and ano not in ajustes:
            raise ValidationError(f"metas do BC {ano}: ano com nota, sem meta ajustada na nota")
        metas.append(
            Meta(
                ano=ano, continua=False, meta=valores[0], tolerancia=tamanhos[0],
                inferior=intervalos[0][0], superior=intervalos[0][1], normas=herdadas,
                meta_original=valores[1] if len(valores) == 2 else None,
                meta_ajustada=ajustes.get(ano) if m.group(2) else None,
                nota=nota if m.group(2) else None,
                ipca_efetivo=_num(_texto(ipca_c[0])),
                carta_aberta=carta_url is not None, carta_url=carta_url,
            )
        )  # fmt: skip
    anos = [x.ano for x in metas]
    if anos != list(range(INICIO_CONTINUA - 1, 1998, -1)):
        raise ValidationError(
            f"metas do BC: anos {anos[-1]}–{anos[0]}, esperado 1999–2024 sem buraco"
        )
    return metas


def _nota_ajuste(trecho: str) -> tuple[dict[int, Decimal], str | None]:
    """Metas ajustadas da nota "*" ({ano: meta}) e o texto da nota, literal."""
    m = re.search(
        r"\* (A Carta Aberta, de [\d/]+, estabeleceu metas ajustadas de [^.]+\.)", _texto(trecho)
    )
    if not m:
        return {}, None
    pares = re.findall(r"(\d+(?:,\d+)?)% para (\d{4})", m.group(1))
    return {int(a): _num(v) for v, a in pares}, m.group(1)


_CONTINUA = re.compile(
    r"A meta, fixada pela (Resolução CMN nº \d\.\d{3}), de [^,]+?\s?, é de (\d+,\d+)%, com "
    r"intervalo de tolerância de ±(\d+,\d+) ponto percentual"
)


def parse_continua(body: bytes, ate_ano: int) -> list[Meta]:
    """Meta contínua (desde 2025), um registro por ano de 2025 até `ate_ano`."""
    m = _CONTINUA.search(_texto(_conteudo(body)))
    if not m:
        raise ValidationError("metas do BC: parágrafo da meta contínua fora do formato")
    meta, tol = _num(m.group(2)), _num(m.group(3))
    return [
        Meta(ano=a, continua=True, meta=meta, tolerancia=tol, inferior=meta - tol,
             superior=meta + tol, normas=(m.group(1),))
        for a in range(INICIO_CONTINUA, ate_ano + 1)
    ]  # fmt: skip
