"""Job de notícias: feeds RSS dos veículos de config/noticias.yaml, separados por tema.

Para cada feed: confere o robots.txt, baixa (sem seguir redirecionamento), guarda a
resposta bruta, lê título, link, data e trecho curto (regra 7) e classifica o tema por
termos públicos, sem IA. Matéria sem tema, fora da janela de dias ou com data no futuro
não é guardada. A falha de um feed não impede os demais; vira erro no relatório.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from collections import defaultdict
from datetime import UTC, datetime, timedelta

import psycopg

from pipelines import config, db
from pipelines.config import Noticias, Registry
from pipelines.jobs.report import Report
from pipelines.raw_store import RawStore
from pipelines.sources import rss

log = logging.getLogger(__name__)


def normaliza(s: str) -> str:
    """Sem acento e sem diferença de maiúsculas: "Inflação" → "inflacao"."""
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).casefold()


def _padrao(termos: list[str]) -> re.Pattern[str] | None:
    if not termos:
        return None
    alt = "|".join(re.escape(normaliza(t)) for t in sorted(termos, key=len, reverse=True))
    return re.compile(rf"(?<![\w-])(?:{alt})(?![\w-])")


class Classificador:
    """Tema(s) de uma matéria pelos termos de config/noticias.yaml."""

    def __init__(self, cfg: Noticias) -> None:
        self.regras = {
            tema: (_padrao(r.termos), _padrao(r.excluir)) for tema, r in cfg.temas.items()
        }
        self.fora_url = tuple(cfg.excluir_url)
        self.fora_titulo = _padrao(cfg.excluir_titulo)

    def temas(self, titulo: str, trecho: str | None, url: str = "") -> list[str]:
        t = normaliza(titulo)
        if any(p in url for p in self.fora_url) or (
            self.fora_titulo and self.fora_titulo.search(t)
        ):
            return []
        tudo = t + " " + normaliza(trecho or "")
        out = []
        for tema, (inclui, exclui) in self.regras.items():
            if inclui and inclui.search(tudo) and not (exclui and exclui.search(t)):
                out.append(tema)
        return out


def veiculo_do_link(url: str, veiculos: list[config.Veiculo]) -> config.Veiculo | None:
    """O veículo de domínio mais específico que cobre o link (folha.uol.com.br vence uol.com.br)."""
    host = url.split("/")[2].lower().split(":")[0]
    cobre = [v for v in veiculos if host == v.dominio or host.endswith("." + v.dominio)]
    return max(cobre, key=lambda v: len(v.dominio)) if cobre else None


def _sync_outlets(conn: psycopg.Connection, cfg: Noticias) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into outlets (id, nome, dominio) values (%s, %s, %s)
            on conflict (id) do update set nome = excluded.nome, dominio = excluded.dominio
            """,
            [(v.id, v.nome, v.dominio) for v in cfg.veiculos],
        )


def _reclassifica(conn: psycopg.Connection, cl: Classificador) -> tuple[int, int]:
    """Aplica as regras atuais às matérias já guardadas: o banco segue sempre a regra
    publicada. Matéria que deixou de ter tema é apagada (nunca seria exibida)."""
    mudou = apagou = 0
    with conn.cursor() as cur:
        rows = cur.execute("select id, url, titulo, trecho, temas from news_articles").fetchall()
        for id_, url, titulo, trecho, temas in rows:
            novo = cl.temas(titulo, trecho, url)
            if not novo:
                cur.execute("delete from news_articles where id = %s", (id_,))
                apagou += 1
            elif novo != list(temas):
                cur.execute("update news_articles set temas = %s where id = %s", (novo, id_))
                mudou += 1
    return mudou, apagou


def run(
    conn: psycopg.Connection,
    store: RawStore,
    registry: Registry,
    agora: datetime | None = None,
) -> Report:
    cfg = config.load_noticias(temas=registry.temas)
    report = Report()
    agora = agora or datetime.now(UTC)
    inicio = agora - timedelta(days=cfg.janela_dias)
    classificador = Classificador(cfg)
    with conn.transaction():
        _sync_outlets(conn, cfg)
        mudou, apagou = _reclassifica(conn, classificador)
    if mudou or apagou:
        report.warnings.append(
            f"notícias: regras de tema aplicadas ao que já estava guardado "
            f"({mudou} reclassificadas, {apagou} sem tema e apagadas)"
        )

    novos: dict[str, int] = defaultdict(int)
    iguais: dict[str, int] = defaultdict(int)
    for v in cfg.veiculos:
        for feed in v.feeds:
            try:
                if not rss.permitido(feed):
                    report.warnings.append(f"{v.id}: robots.txt não permite {feed}; pulado")
                    continue
                raw = rss.fetch(feed)
                objeto = store.save(raw, f"{v.id}_feed")
                itens = rss.parse(raw.body, v.dominio, cfg.trecho_max, raw.content_type)
            except Exception as exc:
                log.exception("feed %s falhou", feed)
                report.errors.append(f"notícias {v.id}: {exc}")
                continue
            linhas = []
            for it in itens:
                if not inicio <= it.publicado_em <= agora + timedelta(hours=1):
                    continue
                temas = classificador.temas(it.titulo, it.trecho, it.url)
                dono = veiculo_do_link(it.url, cfg.veiculos)
                if not temas or dono is None:
                    continue
                linhas.append((dono.id, it, temas))
            with conn.transaction(), conn.cursor() as cur:
                for dono_id, it, temas in linhas:
                    cur.execute(
                        """
                        insert into news_articles (outlet_id, url, titulo, publicado_em, trecho,
                                                   temas, coletado_em, raw_object)
                        values (%s, %s, %s, %s, %s, %s, %s, %s)
                        on conflict (url) do update set titulo = excluded.titulo,
                          trecho = excluded.trecho, temas = excluded.temas
                        returning (xmax = 0)
                        """,
                        (dono_id, it.url, it.titulo, it.publicado_em, it.trecho, temas,
                         raw.fetched_at, objeto),
                    )  # fmt: skip
                    row = cur.fetchone()
                    if row and row[0]:
                        novos[dono_id] += 1
                    else:
                        iguais[dono_id] += 1

    for v in cfg.veiculos:
        if novos[v.id] or iguais[v.id]:
            report.summaries.append(
                db.WriteSummary(f"notícias {v.id}", novos[v.id], 0, iguais[v.id], [])
            )
    return report
