"""Ponto de entrada: `uv run python -m pipelines.run todos` (ou `ipca`, `series`, `eleicoes`,
`noticias`, `agenda`, `regional`, `arrecadacao`, `focus`, `impostos`, `atrasos`, `auditar`).

`atrasos` não coleta nada: confere se algum indicador ou mapa passou do prazo de
divulgação e sai com erro se passou (workflow .github/workflows/atrasos.yml).
`auditar` relê as respostas brutas e confere hash e valor de cada linha do banco.

Variáveis de ambiente:
  DATABASE_URL               conexão Postgres (obrigatória)
  SUPABASE_URL               URL do projeto Supabase (para o Storage)
  SUPABASE_SERVICE_ROLE_KEY  chave de serviço (para o Storage)
  RAW_STORE                  supabase | local (padrão: supabase se houver credenciais)
  RAW_DIR                    pasta das respostas brutas no modo local (padrão: data/raw)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from pipelines import config, db, raw_store
from pipelines.jobs import (
    agenda,
    arrecadacao,
    atrasos,
    auditar,
    eleicoes,
    focus,
    impostos,
    ipca,
    noticias,
    regional,
    series,
)
from pipelines.jobs.report import Report


def todos(conn, store, registry) -> Report:
    report = ipca.run(conn, store, registry).merge(series.run(conn, store, registry))
    for nome, job in (
        ("eleições", eleicoes.run),
        ("notícias", noticias.run),
        ("agenda", agenda.run),
        ("mapas por estado", regional.run),
        ("arrecadação", arrecadacao.run),
        ("Focus", focus.run),
        ("impostos", impostos.run),
    ):
        try:
            report.merge(job(conn, store, registry))
        except Exception as exc:  # a falha de um job não apaga o relatório dos outros
            logging.getLogger(__name__).exception("%s falhou", nome)
            report.errors.append(f"{nome}: {exc}")
    return report


JOBS = {
    "ipca": ipca.run,
    "series": series.run,
    "eleicoes": eleicoes.run,
    "noticias": noticias.run,
    "agenda": agenda.run,
    "regional": regional.run,
    "arrecadacao": arrecadacao.run,
    "focus": focus.run,
    "impostos": impostos.run,
    "atrasos": atrasos.run,
    "auditar": auditar.run,
    "todos": todos,
}


def grava_falhas(job: str, report: Report, pasta: Path) -> Path:
    """Erros do job em JSON, entrada do investigador (pipelines/agentes/investigar.py)."""
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / f"falhas-{job}.json"
    destino.write_text(
        json.dumps(
            {
                "job": job,
                "executado_em": datetime.now(UTC).isoformat(timespec="seconds"),
                "erros": report.errors,
                "avisos": report.warnings,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return destino


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Coletores do oBrasa")
    parser.add_argument("job", choices=sorted(JOBS))
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    registry = config.load()
    store = raw_store.from_env()
    iniciado_em = datetime.now(UTC)
    with db.connect() as conn:
        try:
            report = JOBS[args.job](conn, store, registry)
        except Exception as exc:  # registra a execução antes de propagar
            db.grava_execucao(conn, args.job, iniciado_em, [f"{args.job}: {exc}"], [], [])
            raise
        try:
            db.grava_execucao(
                conn, args.job, iniciado_em, report.errors, report.warnings, report.summaries
            )
        except Exception as exc:  # sem registro, o vigia acusa: o job precisa falhar também
            report.errors.append(f"registro da execução falhou: {exc}")

    for s in report.summaries:
        print(f"{s.series_id}: {s.new} novos, {s.revised} revisados, {s.unchanged} sem mudança")
    for w in report.warnings:
        print(f"AVISO: {w}")
    for e in report.errors:
        print(f"ERRO: {e}", file=sys.stderr)
    if report.errors:
        pasta = Path(os.environ.get("AGENTES_DIR", "data/agentes"))
        print(f"Falhas para o investigador: {grava_falhas(args.job, report, pasta)}")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
