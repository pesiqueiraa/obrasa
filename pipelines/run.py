"""Ponto de entrada: `uv run python -m pipelines.run todos` (ou `ipca`, `series`, `eleicoes`,
`noticias`).

Variáveis de ambiente:
  DATABASE_URL               conexão Postgres (obrigatória)
  SUPABASE_URL               URL do projeto Supabase (para o Storage)
  SUPABASE_SERVICE_ROLE_KEY  chave de serviço (para o Storage)
  RAW_STORE                  supabase | local (padrão: supabase se houver credenciais)
  RAW_DIR                    pasta das respostas brutas no modo local (padrão: data/raw)
"""

from __future__ import annotations

import argparse
import logging
import sys

from pipelines import config, db, raw_store
from pipelines.jobs import eleicoes, ipca, noticias, series
from pipelines.jobs.report import Report


def todos(conn, store, registry) -> Report:
    report = ipca.run(conn, store, registry).merge(series.run(conn, store, registry))
    for nome, job in (("eleições", eleicoes.run), ("notícias", noticias.run)):
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
    "todos": todos,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Coletores do oBrasa")
    parser.add_argument("job", choices=sorted(JOBS))
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    registry = config.load()
    store = raw_store.from_env()
    with db.connect() as conn:
        report = JOBS[args.job](conn, store, registry)

    for s in report.summaries:
        print(f"{s.series_id}: {s.new} novos, {s.revised} revisados, {s.unchanged} sem mudança")
    for w in report.warnings:
        print(f"AVISO: {w}")
    for e in report.errors:
        print(f"ERRO: {e}", file=sys.stderr)
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
