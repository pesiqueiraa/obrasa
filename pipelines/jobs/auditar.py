"""Auditoria: o banco é igual ao que as fontes responderam? (`pipelines.run auditar`)

Para cada resposta bruta citada em `observations.raw_object` e `observacoes_uf.raw_object`:
  1. o SHA-256 do arquivo é o que foi registrado no `.meta.json` na hora da coleta (e o
     prefixo que está no nome do arquivo): ninguém trocou o arquivo depois;
  2. relida com o mesmo parser da coleta, a resposta dá exatamente o valor de cada linha
     do banco que aponta para ela, inclusive as revisões antigas.

Prova que o banco reflete as fontes no dia de cada coleta. Não prova que a fonte estava
certa: isso é trabalho das travas da coleta (metadados, faixa, salto, segunda fonte).
Qualquer divergência vira erro e o job sai com 1.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from collections import defaultdict
from datetime import date
from decimal import Decimal

import psycopg

from pipelines import config
from pipelines.config import MapaUf, Registry, Series
from pipelines.jobs.report import Report
from pipelines.models import ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import bcb_sgs, ibge_agregados, receita

log = logging.getLogger(__name__)

Linha = tuple[str, date, Decimal]  # (série ou "mapa/<id>/<uf>", período, valor no banco)


def confere_hash(ref: str, body: bytes, meta: bytes) -> None:
    info = json.loads(meta)
    digest = hashlib.sha256(body).hexdigest()
    if info.get("sha256") != digest or info.get("bytes") != len(body):
        raise ValidationError(f"{ref}: o arquivo não é o que foi gravado na coleta (hash mudou)")
    m = re.search(r"_([0-9a-f]{12})\.\w+$", ref)
    if not m or not digest.startswith(m.group(1)):
        raise ValidationError(f"{ref}: hash do nome do arquivo não confere com o conteúdo")


def valores_serie(body: bytes, s: Series) -> dict[date, Decimal]:
    """Relê a resposta bruta como a coleta leu."""
    if s.source_id == "bcb_sgs":
        return {o.ref_date: o.value for o in bcb_sgs.parse(body, monthly=s.frequencia != "diaria")}
    if s.source_id == "ibge_agregados":
        var = int(s.codigo_externo.split("/")[1])
        presentes = [int(item["id"]) for item in json.loads(body)]
        data = ibge_agregados.parse_variables(
            body, presentes, classificacao=s.classificacao, tipo=s.frequencia
        )
        return {o.ref_date: o.value for o in data[var]}
    if s.source_id == receita.SOURCE_ID:
        dados = receita.parse(body, config.load_impostos().arrecadacao)
        return {o.ref_date: o.value for o in dados[s.codigo_externo]}
    raise ValidationError(f"{s.id}: fonte {s.source_id} sem parser de auditoria")


def valores_mapa(body: bytes, m: MapaUf) -> dict[tuple[int, date], Decimal]:
    dados = ibge_agregados.parse_uf(
        body, m.variavel, classificacao=m.classificacao, tipo=m.frequencia
    )
    return {(uf, ref): v for uf, s in dados.items() for ref, v in s.valores.items()}


def compara(ref: str, linhas: list[Linha], relido: dict) -> list[str]:
    """Divergências entre as linhas do banco e a resposta relida."""
    erros = []
    for chave, periodo, valor in linhas:
        k = (int(chave.split("/")[2]), periodo) if chave.startswith("mapa/") else periodo
        if k not in relido:
            erros.append(f"{chave} {periodo}: período não está na resposta bruta {ref}")
        elif relido[k] != valor:
            erros.append(f"{chave} {periodo}: banco {valor}, resposta bruta {relido[k]} ({ref})")
    return erros


def run(conn: psycopg.Connection, store: RawStore, registry: Registry) -> Report:
    report = Report()
    series = {s.id: s for s in registry.series}
    mapas = {m.id: m for m in config.load_regional(registry=registry).mapas}

    por_objeto: dict[str, list[Linha]] = defaultdict(list)
    for sid, ref_date, value, raw in conn.execute(
        "select series_id, ref_date, value, raw_object from observations"
    ):
        por_objeto[raw].append((sid, ref_date, value))
    for mapa, uf, ref_date, value, raw in conn.execute(
        "select mapa_id, uf, ref_date, value, raw_object from observacoes_uf"
    ):
        por_objeto[raw].append((f"mapa/{mapa}/{uf}", ref_date, value))

    linhas_ok = 0
    for ref, linhas in sorted(por_objeto.items()):
        try:
            body = store.read(ref)
            confere_hash(ref, body, store.read(ref + ".meta.json"))
            erros = []
            for chave in sorted({c for c, _, _ in linhas}):
                do_grupo = [x for x in linhas if x[0] == chave]
                if chave.startswith("mapa/"):
                    relido = valores_mapa(body, mapas[chave.split("/")[1]])
                elif chave in series:
                    relido = valores_serie(body, series[chave])
                else:
                    erros.append(f"{chave}: série no banco que não está em config/")
                    continue
                erros += compara(ref, do_grupo, relido)
        except Exception as exc:  # um objeto ilegível não interrompe a auditoria dos outros
            report.errors.append(f"{ref}: {exc}")
            continue
        report.errors += erros
        linhas_ok += len(linhas) - len(erros)

    log.info(
        "auditoria: %d respostas brutas, %d linhas iguais ao bruto, %d divergências",
        len(por_objeto),
        linhas_ok,
        len(report.errors),
    )
    return report
