"""Checagem de salto: segura número plausível e errado que a faixa deixa passar.

A faixa barra o absurdo (desemprego de 900%), mas não um 7,1% no lugar de 6,1%. Esta
trava compara cada período novo ou revisado com o comportamento da própria série:

  * a variação contra o período anterior não pode passar da maior variação vista nos
    10 anos anteriores (em pontos percentuais para série de taxa, em % para nível);
  * uma revisão não pode mudar o valor mais do que esse mesmo limite.

Passou do limite, a coleta da série para sem gravar (o site continua com o último valor
válido) até um humano conferir na fonte e registrar a liberação em config/aprovacoes.yaml.
O histórico de liberações fica no git.

Série sem histórico suficiente na janela (menos de MIN_VARIACOES variações, como as
anuais da PNAD) não é conferida: o limite sairia de poucos pontos e daria alarme falso.
Isso vira aviso no relatório, para ninguém achar que a série está coberta.
"""

from __future__ import annotations

import bisect
import itertools
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from pipelines.models import Observation, ValidationError

if TYPE_CHECKING:
    import psycopg

    from pipelines.jobs.report import Report

JANELA_ANOS = 10
MIN_VARIACOES = 12


@dataclass(frozen=True)
class Liberacao:
    """Valor conferido por um humano na fonte (config/aprovacoes.yaml)."""

    serie: str
    periodo: date
    valor: Decimal


def variacao(anterior: Decimal, atual: Decimal, tipo: str) -> Decimal | None:
    """Taxa: diferença em p.p. Nível: variação em %. None se não dá para calcular."""
    if tipo == "taxa":
        return atual - anterior
    if anterior == 0:
        return None
    return (atual / anterior - 1) * 100


def _menos_anos(d: date, anos: int) -> date:
    try:
        return d.replace(year=d.year - anos)
    except ValueError:  # 29/02
        return d.replace(year=d.year - anos, day=28)


@dataclass(frozen=True)
class Resultado:
    conferidos: int
    sem_historico: bool


def confere(
    serie: str,
    tipo: str,
    atuais: dict[date, Decimal],
    novas: Iterable[Observation],
    liberacoes: Iterable[Liberacao] = (),
) -> Resultado:
    """Falha com ValidationError se algum período novo ou revisado saltar demais.

    `atuais` é o valor vigente no banco de cada período; `novas`, o que a coleta trouxe.
    """
    liberado = {(lib.periodo, lib.valor) for lib in liberacoes if lib.serie == serie}
    historico = sorted(atuais.items())
    datas = [d for d, _ in historico]
    mudou = [o for o in novas if atuais.get(o.ref_date) != o.value]
    if not mudou:
        return Resultado(0, False)
    if not historico:  # primeira carga: não há com o que comparar
        return Resultado(0, True)

    def limite_ate(ref: date) -> Decimal | None:
        inicio = bisect.bisect_left(datas, _menos_anos(ref, JANELA_ANOS))
        fim = bisect.bisect_left(datas, ref)
        trecho = historico[inicio:fim]
        vs = [
            abs(v)
            for (_, a), (_, b) in itertools.pairwise(trecho)
            if (v := variacao(a, b, tipo)) is not None
        ]
        return max(vs) if len(vs) >= MIN_VARIACOES else None

    combinado = dict(atuais)
    combinado.update({o.ref_date: o.value for o in mudou})
    ordem = sorted(combinado)
    posicao = {d: i for i, d in enumerate(ordem)}
    unidade = "p.p." if tipo == "taxa" else "%"
    problemas = []
    sem_historico = False
    for o in mudou:
        limite = limite_ate(o.ref_date)
        if limite is None:
            sem_historico = True
            continue
        if (o.ref_date, o.value) in liberado:
            continue
        antigo = atuais.get(o.ref_date)
        if antigo is not None:
            rev = variacao(antigo, o.value, tipo)
            if rev is not None and abs(rev) > limite:
                problemas.append(
                    f"{o.ref_date}: revisão de {antigo} para {o.value} ({abs(rev):.2f} "
                    f"{unidade}; maior variação em {JANELA_ANOS} anos: {limite:.2f})"
                )
                continue
        i = posicao[o.ref_date]
        if i == 0:
            continue
        anterior = combinado[ordem[i - 1]]
        v = variacao(anterior, o.value, tipo)
        if v is not None and abs(v) > limite:
            problemas.append(
                f"{o.ref_date}: {anterior} → {o.value} ({abs(v):.2f} {unidade}; "
                f"maior variação em {JANELA_ANOS} anos: {limite:.2f})"
            )
    if problemas:
        raise ValidationError(
            f"{serie}: salto fora do histórico em {len(problemas)} período(s): "
            + "; ".join(problemas[:5])
            + ". Confira na fonte e, se o valor estiver certo, libere em config/aprovacoes.yaml"
        )
    return Resultado(len(mudou), sem_historico)


def confere_serie(
    conn: psycopg.Connection,
    serie: str,
    tipo: str,
    novas: list[Observation],
    liberacoes: Iterable[Liberacao],
    report: Report,
) -> None:
    """`confere` com o valor vigente lido do banco; histórico curto vira aviso."""
    from pipelines import db

    atuais = {d: v for d, (v, _) in db.current_values(conn, serie).items()}
    if confere(serie, tipo, atuais, novas, liberacoes).sem_historico:
        report.warnings.append(
            f"{serie}: histórico curto para a checagem de salto; período novo não conferido"
        )
