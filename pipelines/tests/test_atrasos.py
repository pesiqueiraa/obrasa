"""Verificação de atraso. Os casos repetem os de apps/web/src/lib/indicator.test.ts, para
que o alerta do pipeline e o aviso "Atrasado desde" do site usem a mesma regra."""

from datetime import date

from pipelines.jobs.atrasos import Divulgacao, atrasado_desde, escolhe, proxima

RELEASES = [
    Divulgacao(date(2026, 9, 1), date(2026, 10, 9)),
    Divulgacao(date(2026, 10, 1), date(2026, 11, 12)),
    Divulgacao(date(2026, 11, 1), date(2026, 12, 11)),
]


def test_proxima_divulgacao_e_a_do_periodo_seguinte():
    assert proxima(RELEASES, date(2026, 9, 1)) == Divulgacao(date(2026, 10, 1), date(2026, 11, 12))


def test_em_dia_ate_o_dia_da_divulgacao():
    p = proxima(RELEASES, date(2026, 9, 1))
    assert atrasado_desde(date(2026, 9, 1), "mensal", p, date(2026, 11, 12)) is None


def test_atrasado_a_partir_do_dia_seguinte():
    p = proxima(RELEASES, date(2026, 9, 1))
    assert atrasado_desde(date(2026, 9, 1), "mensal", p, date(2026, 11, 13)) == date(2026, 11, 13)


def test_sem_calendario_usa_o_prazo_da_frequencia():
    assert atrasado_desde(date(2026, 9, 1), "mensal", None, date(2026, 11, 14)) is None
    assert atrasado_desde(date(2026, 9, 1), "mensal", None, date(2026, 11, 15)) == date(
        2026, 11, 15
    )


def test_diaria_depois_de_5_dias_corridos():
    assert atrasado_desde(date(2026, 10, 30), "diaria", None, date(2026, 11, 3)) is None
    assert atrasado_desde(date(2026, 10, 30), "diaria", None, date(2026, 11, 4)) == date(
        2026, 11, 4
    )


def test_trimestral_usa_o_calendario_do_trimestre_seguinte():
    p = Divulgacao(date(2026, 7, 1), date(2026, 12, 2))
    assert atrasado_desde(date(2026, 4, 1), "trimestral", p, date(2026, 12, 2)) is None
    assert atrasado_desde(date(2026, 4, 1), "trimestral", p, date(2026, 12, 3)) == date(2026, 12, 3)


def test_calendario_de_outro_periodo_cai_no_prazo_padrao():
    # A próxima agendada é de dois meses à frente: não serve para o período seguinte.
    p = Divulgacao(date(2026, 11, 1), date(2026, 12, 11))
    assert atrasado_desde(date(2026, 9, 1), "mensal", p, date(2026, 11, 15)) == date(2026, 11, 15)


def test_anual_tem_30_meses_de_folga():
    # PNAD anual: 2025 sai em junho de 2026; o de 2026, até 14/07/2027.
    assert atrasado_desde(date(2025, 1, 1), "anual", None, date(2027, 7, 14)) is None
    assert atrasado_desde(date(2025, 1, 1), "anual", None, date(2027, 7, 15)) == date(2027, 7, 15)


def test_reserva_so_quando_e_mais_recente():
    assert escolhe(date(2026, 9, 1), date(2026, 9, 1)) == (date(2026, 9, 1), False)
    assert escolhe(date(2026, 8, 1), date(2026, 9, 1)) == (date(2026, 9, 1), True)
    assert escolhe(date(2026, 9, 1), None) == (date(2026, 9, 1), False)
    assert escolhe(None, date(2026, 9, 1)) == (date(2026, 9, 1), True)
    assert escolhe(None, None) == (None, False)


def test_prazo_da_serie_substitui_o_padrao():
    # IBC-Br: ago/2026 no banco; set/2026 sai em meados de novembro.
    assert atrasado_desde(date(2026, 8, 1), "mensal", None, date(2026, 10, 15)) is not None
    assert atrasado_desde(date(2026, 8, 1), "mensal", None, date(2026, 11, 30), (3, 30)) is None
    assert atrasado_desde(date(2026, 8, 1), "mensal", None, date(2026, 12, 1), (3, 30)) == date(
        2026, 12, 1
    )


def test_calendario_vale_mais_que_o_prazo_da_serie():
    p = Divulgacao(date(2026, 9, 1), date(2026, 10, 9))
    assert atrasado_desde(date(2026, 8, 1), "mensal", p, date(2026, 10, 10), (3, 30)) == date(
        2026, 10, 10
    )
