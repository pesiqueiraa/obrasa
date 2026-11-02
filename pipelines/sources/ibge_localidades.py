"""Localidades e malhas do IBGE (ver docs/05). Testados em 01/11/2026:

  GET /api/v1/localidades/municipios
  GET /api/v3/malhas/paises/BR?formato=application/json&intrarregiao=municipio&qualidade=minima

A malha vem em TopoJSON; cada município tem como id o código IBGE de 7 dígitos.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass

from pipelines import http
from pipelines.models import RawResponse, ValidationError

SOURCE_ID = "ibge_localidades"
BASE = "https://servicodados.ibge.gov.br/api"


def fetch_municipios() -> RawResponse:
    return http.get(SOURCE_ID, f"{BASE}/v1/localidades/municipios")


def fetch_malha(intrarregiao: str) -> RawResponse:
    params = {"formato": "application/json", "intrarregiao": intrarregiao, "qualidade": "minima"}
    return http.get(SOURCE_ID, f"{BASE}/v3/malhas/paises/BR", params=params, timeout=180)


@dataclass(frozen=True)
class Municipio:
    ibge: int
    nome: str
    uf: str


def parse_municipios(body: bytes) -> list[Municipio]:
    try:
        data = json.loads(body)
        out = [
            Municipio(
                int(m["id"]),
                m["nome"],
                m["regiao-imediata"]["regiao-intermediaria"]["UF"]["sigla"],
            )
            for m in data
        ]
    except (ValueError, KeyError, TypeError) as exc:
        raise ValidationError(f"lista de municípios fora do formato: {exc}") from exc
    if len(out) < 5500:
        raise ValidationError(f"lista de municípios com só {len(out)} itens")
    return out


def parse_malha(body: bytes) -> dict:
    try:
        topo = json.loads(body)
    except ValueError as exc:
        raise ValidationError("malha não é JSON") from exc
    if topo.get("type") != "Topology" or not topo.get("objects"):
        raise ValidationError("malha não é TopoJSON")
    return topo


def normaliza(nome: str) -> str:
    """'São Thomé das Letras' → 'SAOTHOMEDASLETRAS' (sem acento, caixa ou pontuação)."""
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]", "", s)


def casar_tse(
    municipios: list[Municipio],
    tse: dict[str, tuple[str, str]],
    excecoes: dict[str, int],
) -> dict[str, tuple[int, str]]:
    """Casa código TSE → (código IBGE, 'nome' | 'excecao').

    `tse` é {código TSE: (UF, nome no TSE)}, sem o exterior. Falha se algum município
    ficar sem par, se o casamento não for um para um ou se mudar de UF.
    """
    por_nome: dict[tuple[str, str], list[int]] = {}
    uf_de = {m.ibge: m.uf for m in municipios}
    for m in municipios:
        por_nome.setdefault((m.uf, normaliza(m.nome)), []).append(m.ibge)

    out: dict[str, tuple[int, str]] = {}
    sem_par = []
    for cd, (uf, nome) in tse.items():
        if cd in excecoes:
            out[cd] = (excecoes[cd], "excecao")
            continue
        cands = por_nome.get((uf, normaliza(nome)), [])
        if len(cands) == 1:
            out[cd] = (cands[0], "nome")
        else:
            sem_par.append(f"{cd} {nome} ({uf}): {len(cands)} candidatos no IBGE")
    if sem_par:
        raise ValidationError("municípios do TSE sem par no IBGE: " + "; ".join(sem_par[:10]))
    ibges = [v[0] for v in out.values()]
    if len(set(ibges)) != len(ibges):
        raise ValidationError("casamento TSE → IBGE não é um para um")
    mudou_uf = [cd for cd, (ib, _) in out.items() if uf_de.get(ib) != tse[cd][0]]
    if mudou_uf:
        raise ValidationError(f"exceções apontam para outra UF: {mudou_uf}")
    return out
