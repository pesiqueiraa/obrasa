"""Checagem de salto: segura número plausível e errado que a faixa deixa passar.

A faixa barra o absurdo (desemprego de 900%), mas não um 7,1% no lugar de 6,1%. Esta
trava compara cada período novo ou revisado com o comportamento da própria série:

  * a variação contra o período anterior não pode passar da maior variação vista nos
    10 anos anteriores (em pontos percentuais para série de taxa, em % para nível);
  * uma revisão não pode mudar o valor mais do que esse mesmo limite.

Passou do limite, a coleta da série para sem gravar (o site continua com o último valor
válido). A liberação é automática (`confere_serie`, tabela `saltos_vistos`), quando:

  * a segunda fonte da série (`conferir_com`) publica o mesmo valor para o período; ou
  * a fonte publica o mesmo valor para o mesmo período em coletas separadas por pelo
    menos PERSISTENCIA_HORAS: erro passageiro da fonte costuma ser corrigido antes disso.
    Erro nosso (parser na coluna errada, escala trocada) não depende desta trava: o valor
    de referência de 2019, a auditoria do bruto e a descrição na fonte pegam.

Enquanto espera, o salto é aviso, não erro: ninguém precisa fazer nada. Liberação manual
em config/aprovacoes.yaml continua possível, mas não é necessária.

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
PERSISTENCIA_HORAS = 20


class SaltoError(ValidationError):
    """Salto fora do histórico; `bloqueados` traz (período, valor) de cada um."""

    def __init__(self, mensagem: str, bloqueados: list[tuple[date, Decimal]]):
        super().__init__(mensagem)
        self.bloqueados = bloqueados


class SaltoEmEspera(SaltoError):
    """Salto visto, esperando a confirmação automática. O job registra como aviso."""


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
    bloqueados: list[tuple[date, Decimal]] = []
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
                bloqueados.append((o.ref_date, o.value))
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
            bloqueados.append((o.ref_date, o.value))
    if problemas:
        raise SaltoError(
            f"{serie}: salto fora do histórico em {len(problemas)} período(s): "
            + "; ".join(problemas[:5]),
            bloqueados,
        )
    return Resultado(len(mudou), sem_historico)


def _registra(conn: psycopg.Connection, serie: str, d: date, v: Decimal, motivo: str | None):
    conn.execute(
        "insert into saltos_vistos (serie, periodo, valor, liberado, motivo) "
        "values (%s, %s, %s, %s, %s)",
        (serie, d, v, motivo is not None, motivo),
    )


def _visto_desde(conn: psycopg.Connection, serie: str, d: date, v: Decimal):
    """Primeira vez que a fonte publicou este valor para o período, se faz tempo bastante."""
    return conn.execute(
        """
        select min(visto_em) from saltos_vistos
        where serie = %s and periodo = %s and valor = %s and not liberado
        having min(visto_em) <= now() - make_interval(hours => %s)
        """,
        (serie, d, v, PERSISTENCIA_HORAS),
    ).fetchone()


def confere_com_registro(
    conn: psycopg.Connection,
    serie: str,
    tipo: str,
    atuais: dict[date, Decimal],
    novas: list[Observation],
    liberacoes: Iterable[Liberacao],
    report: Report,
    confirmados: Iterable[date] = (),
) -> Resultado:
    """`confere` com liberação automática. `confirmados`: períodos em que a segunda fonte
    publicou o mesmo valor. Levanta SaltoEmEspera se algum salto ainda não foi confirmado."""
    liberacoes = list(liberacoes)
    try:
        return confere(serie, tipo, atuais, novas, liberacoes)
    except SaltoError as exc:
        bloqueados = exc.bloqueados
        mensagem = str(exc)
    confirmados = set(confirmados)
    motivos: dict[tuple[date, Decimal], str] = {}
    for d, v in bloqueados:
        if d in confirmados:
            motivos[(d, v)] = "a segunda fonte publica o mesmo valor"
        elif linha := _visto_desde(conn, serie, d, v):
            motivos[(d, v)] = f"a fonte publica o mesmo valor desde {linha[0]:%d/%m/%Y %H:%M} UTC"
    pendentes = [b for b in bloqueados if b not in motivos]
    if pendentes:
        for d, v in pendentes:
            _registra(conn, serie, d, v, None)
        raise SaltoEmEspera(
            f"{mensagem}. Valor segurado; liberação automática se a fonte mantiver o mesmo "
            f"valor por {PERSISTENCIA_HORAS} horas",
            pendentes,
        )
    auto = [Liberacao(serie, d, v) for d, v in bloqueados]
    resultado = confere(serie, tipo, atuais, novas, [*liberacoes, *auto])
    for (d, v), motivo in motivos.items():
        _registra(conn, serie, d, v, motivo)
        report.warnings.append(f"{serie}: salto em {d} ({v}) liberado automaticamente: {motivo}")
    return resultado


def confere_serie(
    conn: psycopg.Connection,
    serie: str,
    tipo: str,
    novas: list[Observation],
    liberacoes: Iterable[Liberacao],
    report: Report,
    confirmados: Iterable[date] = (),
) -> None:
    """`confere_com_registro` com o valor vigente lido do banco; histórico curto vira aviso."""
    from pipelines import db

    atuais = {d: v for d, (v, _) in db.current_values(conn, serie).items()}
    r = confere_com_registro(conn, serie, tipo, atuais, novas, liberacoes, report, confirmados)
    if r.sem_historico:
        report.warnings.append(
            f"{serie}: histórico curto para a checagem de salto; período novo não conferido"
        )
