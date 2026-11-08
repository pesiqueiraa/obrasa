"""Arrecadação federal por tributo (Receita Federal), config/impostos.yaml. Ver docs/05.

Baixa o CSV inteiro (cerca de 2,4 MB) e soma as 27 UFs por grupo de tributos. Se o arquivo
for igual ao da última coleta gravada (mesmo hash), nada é guardado de novo: a Receita
atualiza o arquivo uma vez por mês, e o Storage não precisa de uma cópia por dia.

As mesmas travas do job `series`: faixa plausível, sem período no futuro, sem buraco e
checagem de salto (pipelines/saltos.py). Se um grupo falhar, nenhum é gravado.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo

import psycopg

from pipelines import config, db, saltos
from pipelines.config import Registry
from pipelines.jobs.report import Report
from pipelines.jobs.series import validate
from pipelines.models import ValidationError
from pipelines.raw_store import RawStore
from pipelines.sources import receita

log = logging.getLogger(__name__)


def ultimo_hash(conn: psycopg.Connection, series_id: str) -> str | None:
    """Prefixo do hash da resposta bruta mais recente gravada para a série."""
    with conn.cursor() as cur:
        cur.execute(
            "select raw_object from observations where series_id = %s "
            "order by collected_at desc limit 1",
            (series_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    nome = row[0].rsplit("/", 1)[-1]
    return nome.rsplit("_", 1)[-1].split(".", 1)[0]


def run(
    conn: psycopg.Connection, store: RawStore, registry: Registry, today: date | None = None
) -> Report:
    today = today or datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    report = Report()
    cfg = config.load_impostos().arrecadacao
    series = {s.codigo_externo: s for s in registry.series if s.coletor == "arrecadacao"}
    esperados = {"total", *cfg.grupos}
    if set(series) != esperados:
        raise ValidationError(
            f"arrecadação: séries em config/sources.yaml {sorted(series)} "
            f"diferem dos grupos de config/impostos.yaml {sorted(esperados)}"
        )
    with conn.transaction():
        db.sync_registry(conn, registry)

    raw = receita.fetch(cfg.url)
    digest = hashlib.sha256(raw.body).hexdigest()[:12]
    if ultimo_hash(conn, series["total"].id) == digest:
        log.info("arrecadação: arquivo igual ao da última coleta (%s); nada a gravar", digest)
        return report

    dados = receita.parse(raw.body, cfg)
    for grupo, s in series.items():
        validate(dados.get(grupo, []), s, today)
        saltos.confere_serie(conn, s.id, s.tipo, dados[grupo], registry.liberacoes, report)
    objeto = store.save(raw, "arrecadacao_estado")
    with conn.transaction():
        for grupo, s in series.items():
            report.summaries.append(
                db.write_observations(
                    conn, s.id, dados[grupo], collected_at=raw.fetched_at, raw_object=objeto
                )
            )
    log.info("arrecadação: %d grupos até %s", len(series), dados["total"][-1].ref_date)
    return report
