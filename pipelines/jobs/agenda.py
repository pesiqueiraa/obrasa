"""Agenda: reuniões do Copom (config/copom.yaml), conferidas pelo Banco Central.

As divulgações do IBGE já entram em releases.proxima_divulgacao pelo job `series`, que lê
o calendário oficial do IBGE. O Banco Central não publica o calendário do Copom em API;
as datas ficam em config/copom.yaml e cada reunião que já aconteceu é conferida na API de
comunicados do BC (número da reunião e dia da decisão). Se alguma divergir, nada é
gravado: a agenda não mostra data que a fonte desmente.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo

import psycopg

from pipelines import config, http
from pipelines.config import Copom, Registry
from pipelines.jobs.report import Report
from pipelines.models import ValidationError
from pipelines.raw_store import RawStore

log = logging.getLogger(__name__)

SOURCE_ID = "bcb_copom"
COMUNICADOS = "https://www.bcb.gov.br/api/servico/sitebcb/copom/comunicados"


def decisoes_publicadas(body: bytes) -> dict[int, date]:
    """Número da reunião → dia da decisão, segundo os comunicados do BC."""
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"comunicados do Copom: resposta não é JSON: {exc}") from exc
    itens = payload.get("conteudo") if isinstance(payload, dict) else None
    if not isinstance(itens, list):
        raise ValidationError("comunicados do Copom sem lista 'conteudo'")
    out = {}
    for it in itens:
        try:
            out[int(it["nro_reuniao"])] = date.fromisoformat(it["dataReferencia"][:10])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValidationError(f"comunicado fora do formato: {it!r}") from exc
    return out


def confere(cfg: Copom, publicadas: dict[int, date], hoje: date) -> list[int]:
    """Falha se uma reunião passada diverge do BC. Devolve as reuniões conferidas."""
    conferidas = []
    for r in cfg.reunioes:
        if r.decisao >= hoje:
            continue  # ainda não aconteceu: não há comunicado para conferir
        dia = publicadas.get(r.numero)
        if dia is None:
            if r.numero >= min(publicadas, default=r.numero):
                raise ValidationError(f"Copom {r.numero}: sem comunicado do BC para {r.decisao}")
            continue  # mais antiga que a lista de comunicados pedida
        if dia != r.decisao:
            raise ValidationError(
                f"Copom {r.numero}: config/copom.yaml diz {r.decisao}, o BC diz {dia}"
            )
        conferidas.append(r.numero)
    return conferidas


def run(
    conn: psycopg.Connection, store: RawStore, registry: Registry, hoje: date | None = None
) -> Report:
    hoje = hoje or datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    report = Report()
    cfg = config.load_copom()
    raw = http.get(SOURCE_ID, COMUNICADOS, params={"quantidade": str(len(cfg.reunioes) + 2)})
    objeto = store.save(raw, "copom_comunicados")
    conferidas = set(confere(cfg, decisoes_publicadas(raw.body), hoje))

    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from agenda_eventos where source_id = %s", (SOURCE_ID,))
        cur.executemany(
            """
            insert into agenda_eventos (source_id, chave, titulo, inicio, fim, url, conferido_em, raw_object)
            values (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    SOURCE_ID,
                    f"copom-{r.numero}",
                    f"Reunião do Copom ({r.numero}ª)",
                    r.inicio,
                    r.decisao,
                    cfg.fonte,
                    raw.fetched_at if r.numero in conferidas else None,
                    objeto,
                )
                for r in cfg.reunioes
            ],
        )
    futuras = [r for r in cfg.reunioes if r.decisao >= hoje]
    if not futuras:
        report.warnings.append(
            "agenda: config/copom.yaml sem reunião futura; incluir o calendário do próximo ano"
        )
    log.info("agenda: %d reuniões do Copom, %d conferidas", len(cfg.reunioes), len(conferidas))
    return report
