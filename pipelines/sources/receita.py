"""Arrecadação federal por tributo e UF, da Receita Federal. Ver docs/05.

GET https://www.gov.br/receitafederal/dados/arrecadacao-estado.csv

CSV em ISO-8859-1, `;`, uma linha por ano, mês (por extenso) e UF, uma coluna por tributo,
em reais correntes. Testado em 07/11/2026: jan/2000 a set/2026. O site recusa HEAD (403),
mas responde ao GET.

Formato dos números (conferido de 2003 a set/2026): inteiro (`231`), vírgula decimal
(`133165371,2`, às vezes com 3 casas) e, em jun/2023 e mai/2024, ponto de milhar
(`1.753.289.168`, `226.708.856,85`). Qualquer outro formato faz a leitura falhar. Em 2001 e
2002 a vírgula separa milhar (`47,953,915`); esses anos ficam fora (`desde`).

Saída: um valor por grupo de tributos (config/impostos.yaml) e mês, somando as 27 UFs, em
R$ milhões, mais o grupo `total` com todas as colunas.
"""

from __future__ import annotations

import csv
import io
import re
from collections import defaultdict
from datetime import date
from decimal import Decimal

from pipelines import http
from pipelines.config import Arrecadacao
from pipelines.models import Observation, RawResponse, ValidationError

SOURCE_ID = "receita_arrecadacao"
UFS = 27
MESES = {
    m: i + 1
    for i, m in enumerate(
        [
            "Janeiro",
            "Fevereiro",
            "Março",
            "Abril",
            "Maio",
            "Junho",
            "Julho",
            "Agosto",
            "Setembro",
            "Outubro",
            "Novembro",
            "Dezembro",
        ]
    )
}
MILHAO = Decimal(1_000_000)
_INTEIRO_OU_DECIMAL = re.compile(r"-?\d+(,\d+)?")
_MILHAR_COM_PONTO = re.compile(r"-?\d{1,3}(\.\d{3})+(,\d+)?")


def fetch(url: str) -> RawResponse:
    return http.get(SOURCE_ID, url)


def numero(texto: str, onde: str) -> Decimal:
    s = texto.strip()
    if not s:
        return Decimal(0)
    if _INTEIRO_OU_DECIMAL.fullmatch(s):
        return Decimal(s.replace(",", "."))
    if _MILHAR_COM_PONTO.fullmatch(s):
        return Decimal(s.replace(".", "").replace(",", "."))
    raise ValidationError(f"arrecadação: número em formato desconhecido {texto!r} ({onde})")


def parse(body: bytes, cfg: Arrecadacao) -> dict[str, list[Observation]]:
    """Grupo → observações mensais em R$ milhões, de `cfg.desde` em diante."""
    linhas = list(csv.reader(io.StringIO(body.decode("latin-1")), delimiter=";"))
    if not linhas:
        raise ValidationError("arrecadação: arquivo vazio")
    cabecalho = [c.strip() for c in linhas[0]]
    if cabecalho[:3] != ["Ano", "Mês", "UF"]:
        raise ValidationError(f"arrecadação: cabeçalho inesperado {cabecalho[:3]}")
    colunas = cabecalho[3:]
    grupo_da_coluna = {c: g for g, gr in cfg.grupos.items() for c in gr.colunas}
    sem_grupo = [c for c in colunas if c not in grupo_da_coluna]
    if sem_grupo:
        raise ValidationError(
            f"arrecadação: coluna nova sem grupo em config/impostos.yaml: {sem_grupo}"
        )

    somas: dict[tuple[str, date], Decimal] = defaultdict(Decimal)
    ufs: dict[date, set[str]] = defaultdict(set)
    for n, linha in enumerate(linhas[1:], start=2):
        if not any(x.strip() for x in linha):
            continue
        if len(linha) != len(cabecalho):
            raise ValidationError(f"arrecadação: linha {n} com {len(linha)} colunas")
        try:
            ref = date(int(linha[0]), MESES[linha[1].strip()], 1)
        except (KeyError, ValueError) as exc:
            raise ValidationError(f"arrecadação: ano ou mês inválido na linha {n}") from exc
        if ref < cfg.desde:
            continue
        uf = linha[2].strip()
        if uf in ufs[ref]:
            raise ValidationError(f"arrecadação: {uf} repetida em {ref:%m/%Y}")
        ufs[ref].add(uf)
        valores = {c: numero(v, f"linha {n}, {c}") for c, v in zip(colunas, linha[3:], strict=True)}
        for total, *partes in cfg.exclusivas:  # total e partes nunca juntos na mesma linha
            if valores.get(total) and any(valores.get(c) for c in partes):
                raise ValidationError(f"arrecadação: {total} e suas partes juntos na linha {n}")
        for c, v in valores.items():
            somas[(grupo_da_coluna[c], ref)] += v
            somas[("total", ref)] += v

    incompletos = sorted(ref for ref, u in ufs.items() if len(u) != UFS)
    if incompletos:
        raise ValidationError(f"arrecadação: meses sem as 27 UFs: {incompletos}")
    out: dict[str, list[Observation]] = defaultdict(list)
    for (grupo, ref), v in sorted(somas.items(), key=lambda kv: kv[0][1]):
        out[grupo].append(Observation(ref_date=ref, value=v / MILHAO))
    return dict(out)
