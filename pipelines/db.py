"""Gravação no Postgres (Supabase). Revisões nunca sobrescrevem: viram nova linha."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

import psycopg
from psycopg.types.json import Jsonb

from pipelines.config import Registry
from pipelines.models import Observation


def connect() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "defina DATABASE_URL (ex.: postgresql://postgres:postgres@127.0.0.1:55322/postgres)"
        )
    # autocommit: cada `with conn.transaction()` é uma transação própria, então a falha
    # de uma fonte não desfaz o que outra já gravou.
    conn = psycopg.connect(url, autocommit=True)
    # Papel sem poder de mudar o schema nem de alterar as tabelas de dado
    # (supabase/migrations/20261109000000_integridade.sql). Vale para a sessão inteira.
    conn.execute(f"set role {ROLE}")
    # Com o pooler em modo transação (porta 6543 do Supabase) o `set role` não vale para
    # os comandos seguintes. Use a conexão direta ou o pooler em modo sessão (porta 5432).
    if conn.execute("select current_user").fetchone()[0] != ROLE:
        conn.close()
        raise RuntimeError(
            f"a conexão não ficou com o papel {ROLE}: use DATABASE_URL sem pooler de transação"
        )
    return conn


ROLE = "coletor"


@dataclass(frozen=True)
class PlannedRow:
    ref_date: date
    value: Decimal
    revision: int


def plan_revisions(
    current: dict[date, tuple[Decimal, int]], incoming: list[Observation]
) -> list[PlannedRow]:
    """Decide o que inserir, dado o valor vigente (valor, revisão) de cada período.

    * período novo: revisão 0;
    * valor diferente do vigente: revisão vigente + 1 (a linha antiga fica);
    * valor igual: nada.
    """
    rows = []
    for obs in incoming:
        existing = current.get(obs.ref_date)
        if existing is None:
            rows.append(PlannedRow(obs.ref_date, obs.value, 0))
        elif existing[0] != obs.value:
            rows.append(PlannedRow(obs.ref_date, obs.value, existing[1] + 1))
    return rows


def sync_registry(conn: psycopg.Connection, registry: Registry) -> None:
    """Espelha config/*.yaml no banco (fontes, séries e indicadores)."""
    with conn.cursor() as cur:
        for s in registry.sources:
            cur.execute(
                """
                insert into sources (id, nome, orgao, url_fonte, url_documentacao, url_metodologia, licenca)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set nome = excluded.nome, orgao = excluded.orgao,
                  url_fonte = excluded.url_fonte, url_documentacao = excluded.url_documentacao,
                  url_metodologia = excluded.url_metodologia, licenca = excluded.licenca
                """,
                (
                    s.id,
                    s.nome,
                    s.orgao,
                    s.url_fonte,
                    s.url_documentacao,
                    s.url_metodologia,
                    s.licenca,
                ),
            )
        for s in registry.series:
            cur.execute(
                """
                insert into series (id, source_id, codigo_externo, nome, unidade, frequencia, tipo,
                                    monetaria, nota_metodologia, classificacao, prazo_meses,
                                    prazo_dias)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set nome = excluded.nome, unidade = excluded.unidade,
                  frequencia = excluded.frequencia, tipo = excluded.tipo,
                  monetaria = excluded.monetaria, nota_metodologia = excluded.nota_metodologia,
                  classificacao = excluded.classificacao, prazo_meses = excluded.prazo_meses,
                  prazo_dias = excluded.prazo_dias
                """,
                (
                    s.id,
                    s.source_id,
                    s.codigo_externo,
                    s.nome,
                    s.unidade,
                    s.frequencia,
                    s.tipo,
                    s.monetaria,
                    s.nota_metodologia,
                    s.classificacao,
                    s.prazo[0] if s.prazo else None,
                    s.prazo[1] if s.prazo else None,
                ),
            )
        for i in registry.indicators:
            cur.execute(
                """
                insert into indicators (slug, titulo, series_id, fallback_series_id, transformacao,
                                        verificacao, janela_padrao, frase_template, url_metodologia,
                                        ordem, tema, casas_decimais, serie_nominal)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (slug) do update set titulo = excluded.titulo,
                  series_id = excluded.series_id, fallback_series_id = excluded.fallback_series_id,
                  transformacao = excluded.transformacao, verificacao = excluded.verificacao,
                  janela_padrao = excluded.janela_padrao, frase_template = excluded.frase_template,
                  url_metodologia = excluded.url_metodologia, ordem = excluded.ordem,
                  tema = excluded.tema, casas_decimais = excluded.casas_decimais,
                  serie_nominal = excluded.serie_nominal
                """,
                (
                    i.slug,
                    i.titulo,
                    i.fonte_primaria.series_id,
                    i.fonte_reserva.series_id if i.fonte_reserva else None,
                    i.transformacao,
                    i.verificacao,
                    i.janela_padrao,
                    i.frase_template,
                    i.url_metodologia,
                    i.ordem,
                    i.tema,
                    i.casas_decimais,
                    i.serie_nominal.series_id if i.serie_nominal else None,
                ),
            )


def current_values(conn: psycopg.Connection, series_id: str) -> dict[date, tuple[Decimal, int]]:
    with conn.cursor() as cur:
        cur.execute(
            "select ref_date, value, revision from observations_current where series_id = %s",
            (series_id,),
        )
        return {r[0]: (r[1], r[2]) for r in cur.fetchall()}


@dataclass(frozen=True)
class WriteSummary:
    series_id: str
    new: int
    revised: int
    unchanged: int
    missing_in_source: list[date]


def write_observations(
    conn: psycopg.Connection,
    series_id: str,
    observations: list[Observation],
    *,
    collected_at: datetime,
    raw_object: str | Mapping[date, str],
) -> WriteSummary:
    """Grava o que mudou. `raw_object` é a resposta bruta de todas as observações, ou
    um mapa data → resposta bruta quando a coleta foi feita em várias requisições."""

    def raw_for(ref: date) -> str:
        return raw_object if isinstance(raw_object, str) else raw_object[ref]

    current = current_values(conn, series_id)
    planned = plan_revisions(current, observations)
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into observations (series_id, ref_date, value, revision, collected_at, raw_object)
            values (%s, %s, %s, %s, %s, %s)
            """,
            [
                (series_id, p.ref_date, p.value, p.revision, collected_at, raw_for(p.ref_date))
                for p in planned
            ],
        )
        cur.execute(
            "update series set inicio = (select min(ref_date) from observations where series_id = %s) "
            "where id = %s",
            (series_id, series_id),
        )
    incoming = {o.ref_date for o in observations}
    return WriteSummary(
        series_id=series_id,
        new=sum(1 for p in planned if p.revision == 0),
        revised=sum(1 for p in planned if p.revision > 0),
        unchanged=len(observations) - len(planned),
        missing_in_source=sorted(set(current) - incoming),
    )


def upsert_released(
    conn: psycopg.Connection, series_id: str, released: dict[date, datetime]
) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into releases (series_id, ref_date, divulgado_em) values (%s, %s, %s)
            on conflict (series_id, ref_date) do update set divulgado_em = excluded.divulgado_em
            """,
            [(series_id, ref, at) for ref, at in released.items()],
        )


def upsert_scheduled(conn: psycopg.Connection, series_id: str, scheduled: dict[date, date]) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into releases (series_id, ref_date, proxima_divulgacao) values (%s, %s, %s)
            on conflict (series_id, ref_date) do update set proxima_divulgacao = excluded.proxima_divulgacao
            """,
            [(series_id, ref, day) for ref, day in scheduled.items()],
        )


def grava_execucao(
    conn: psycopg.Connection,
    job: str,
    iniciado_em: datetime,
    erros: list[str],
    avisos: list[str],
    summaries: list[WriteSummary],
) -> None:
    """Uma linha em `execucoes` por job rodado, com sucesso ou não (vigia, /saude)."""
    conn.execute(
        """
        insert into execucoes (job, iniciado_em, ok, novos, revisados, erros, avisos)
        values (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            job,
            iniciado_em,
            not erros,
            sum(x.new for x in summaries),
            sum(x.revised for x in summaries),
            Jsonb(erros),
            Jsonb(avisos),
        ),
    )
