"""Coleta genérica (pipelines/jobs/series.py) e as extensões dos coletores."""

import itertools
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from pipelines import config
from pipelines.config import Series
from pipelines.jobs.series import validate
from pipelines.models import Observation, ValidationError
from pipelines.sources import bcb_sgs, ibge_agregados

FIX = Path(__file__).parent / "fixtures"


def _series(**kw) -> Series:
    base = dict(
        id="bcb_sgs_1",
        source_id="bcb_sgs",
        codigo_externo="1",
        nome="x",
        unidade="%",
        frequencia="mensal",
        tipo="taxa",
        monetaria=False,
        faixa=(Decimal(0), Decimal(10)),
        na_fonte={"nome": "x", "unidade": "%", "periodicidade": "M"},
    )
    return Series(**{**base, **kw})


def _obs(*pairs) -> list[Observation]:
    return [Observation(date.fromisoformat(d), Decimal(v)) for d, v in pairs]


# --- períodos do IBGE ---


def test_quarter_period_maps_to_first_month_of_quarter():
    assert ibge_agregados.period_to_date("202602", "trimestral") == date(2026, 4, 1)
    assert ibge_agregados.period_to_date("202604", "trimestral") == date(2026, 10, 1)
    assert ibge_agregados.date_to_period(date(2026, 7, 1), "trimestral") == "202603"
    with pytest.raises(ValidationError):
        ibge_agregados.period_to_date("202605", "trimestral")
    with pytest.raises(ValueError):
        ibge_agregados.date_to_period(date(2026, 8, 1), "trimestral")


def test_moving_quarter_period_is_the_final_month():
    data = ibge_agregados.parse_variables(
        (FIX / "ibge_6381_4099.json").read_bytes(), [4099], tipo="trimestral_movel"
    )
    refs = [o.ref_date for o in data[4099]]
    assert refs == sorted(refs) and all(r.day == 1 for r in refs)
    assert refs[-1] == date(2026, 9, 1)  # jul–set/2026


def test_classification_is_checked():
    body = (FIX / "ibge_5932_6562_6564_pib.json").read_bytes()
    data = ibge_agregados.parse_variables(
        body, [6562, 6564], classificacao="11255[90707]", tipo="trimestral"
    )
    assert [o.ref_date for o in data[6562]] == [
        date(2025, 7, 1),
        date(2025, 10, 1),
        date(2026, 1, 1),
        date(2026, 4, 1),
    ]
    assert data[6562][2].value == Decimal("2.0")  # 1º tri/2026 na resposta guardada
    with pytest.raises(ValidationError, match="classificação"):
        ibge_agregados.parse_variables(body, [6562, 6564], tipo="trimestral")
    with pytest.raises(ValidationError, match=r"11255\[90706\]"):
        ibge_agregados.parse_variables(
            body, [6562, 6564], classificacao="11255[90706]", tipo="trimestral"
        )


# --- SGS diário ---


def test_daily_windows_cover_range_without_overlap():
    ws = bcb_sgs.windows(date(1999, 3, 5), date(2026, 11, 1))
    assert ws[0][0] == date(1999, 3, 5) and ws[-1][1] == date(2026, 11, 1)
    for (_, end), (start, _) in itertools.pairwise(ws):
        assert (start - end).days == 1
    assert all((b.year - a.year) <= 10 for a, b in ws)


def test_selic_target_has_future_dates_that_must_be_cut():
    obs = bcb_sgs.parse((FIX / "bcb_sgs_432_recente.json").read_bytes(), monthly=False)
    today = date(2026, 11, 1)
    assert any(o.ref_date > today for o in obs)  # a fonte publica até a próxima reunião
    s = _series(id="bcb_sgs_432", codigo_externo="432", frequencia="diaria", faixa=(0, 100))
    with pytest.raises(ValidationError, match="futuro"):
        validate(obs, s, today)
    validate([o for o in obs if o.ref_date <= today], s, today)


# --- validação genérica ---


def test_validate_range_gap_and_empty():
    s = _series()
    today = date(2026, 11, 1)
    validate(_obs(("2026-01-01", "1"), ("2026-02-01", "2")), s, today)
    with pytest.raises(ValidationError, match="faixa"):
        validate(_obs(("2026-01-01", "11")), s, today)
    with pytest.raises(ValidationError, match="buraco"):
        validate(_obs(("2026-01-01", "1"), ("2026-03-01", "2")), s, today)
    with pytest.raises(ValidationError, match="nenhuma"):
        validate([], s, today)


def test_validate_quarterly_step_is_three_months():
    s = _series(frequencia="trimestral")
    today = date(2026, 11, 1)
    validate(_obs(("2026-01-01", "1"), ("2026-04-01", "2")), s, today)
    with pytest.raises(ValidationError, match="buraco"):
        validate(_obs(("2026-01-01", "1"), ("2026-07-01", "2")), s, today)


def test_daily_series_skip_gap_check():
    s = _series(frequencia="diaria")
    validate(_obs(("2026-10-30", "1"), ("2026-11-02", "1")), s, date(2026, 11, 2))


# --- registro ---


def test_registry_rules_for_new_fields():
    r = config.load()
    assert {t.slug for t in r.temas} >= {"economia", "trabalho", "contas-publicas"}
    by_slug = {i.slug: i for i in r.indicators}
    assert by_slug["rendimento-medio"].serie_nominal is not None  # regra 3
    with pytest.raises(ValueError, match="faixa"):
        _series(faixa=None)
    with pytest.raises(ValueError, match="serie_nominal"):
        config.Indicator(
            slug="x",
            titulo="x",
            tema="economia",
            fonte_primaria=by_slug["selic"].fonte_primaria,
            unidade="R$",
            tipo_serie="nivel",
            frequencia="mensal",
            janela_padrao="5a",
            monetaria=True,
            frase_template="selic.pt.txt",
        )


# --- séries anuais com duas classificações (Educação, PNAD Contínua anual) ---


def _resposta_anual(classificacoes: list[tuple[str, str]], serie: dict[str, str]) -> bytes:
    import json

    return json.dumps(
        [
            {
                "id": "10267",
                "resultados": [
                    {
                        "classificacoes": [
                            {"id": c, "nome": "x", "categoria": {k: "x"}} for c, k in classificacoes
                        ],
                        "series": [
                            {"localidade": {"id": "1", "nivel": {"id": "N1"}}, "serie": serie}
                        ],
                    }
                ],
            }
        ]
    ).encode()


def test_ibge_anual_com_duas_classificacoes():
    # valores reais da tabela 7113 (analfabetismo, 15 anos ou mais), sem 2020 e 2021
    serie = {"2019": "6.1", "2022": "5.6", "2025": "4.9"}
    body = _resposta_anual([("2", "6794"), ("58", "2795")], serie)
    out = ibge_agregados.parse_variables(
        body, [10267], classificacao="2[6794]|58[2795]", tipo="anual"
    )
    assert [(o.ref_date, o.value) for o in out[10267]] == [
        (date(2019, 1, 1), Decimal("6.1")),
        (date(2022, 1, 1), Decimal("5.6")),
        (date(2025, 1, 1), Decimal("4.9")),
    ]
    assert ibge_agregados.date_to_period(date(2025, 1, 1), "anual") == "2025"
    # categoria diferente da pedida é recusada
    outra = _resposta_anual([("2", "4"), ("58", "2795")], serie)
    with pytest.raises(ValidationError, match="classificação"):
        ibge_agregados.parse_variables(
            outra, [10267], classificacao="2[6794]|58[2795]", tipo="anual"
        )
    with pytest.raises(ValidationError, match="AAAA"):
        ibge_agregados.period_to_date("202501", "anual")


def test_buraco_so_aceito_se_declarado():
    today = date(2026, 11, 1)
    obs = _obs(("2019-01-01", "6.1"), ("2022-01-01", "5.6"), ("2023-01-01", "5.4"))
    sem = _series(frequencia="anual")
    with pytest.raises(ValidationError, match="buraco"):
        validate(obs, sem, today)
    com = _series(frequencia="anual", lacunas=[date(2020, 1, 1), date(2021, 1, 1)])
    validate(obs, com, today)
    # só 2020 declarado: falta 2021 sem explicação
    parcial = _series(frequencia="anual", lacunas=[date(2020, 1, 1)])
    with pytest.raises(ValidationError, match="buraco"):
        validate(obs, parcial, today)


def test_id_da_serie_com_categorias():
    assert config.sufixo_classificacao("2[6794]|58[2795]") == "_6794_2795"
    ref = config.FonteRef(
        orgao="IBGE", tipo="ibge_agregados", tabela=7113, variavel=10267,
        classificacao="2[6794]|58[2795]", status="ok",
    )  # fmt: skip
    assert ref.series_id == "ibge_agregados_7113_10267_6794_2795"


class _Store:
    def __init__(self):
        self.salvos = []

    def save(self, raw, name):
        self.salvos.append(name)
        return f"local://{name}"


def test_descricao_diferente_para_antes_de_baixar_os_dados(monkeypatch):
    """IBC-Br com a unidade trocada na fonte: a coleta para sem pedir os dados nem gravar."""
    from pipelines.jobs import series as job
    from pipelines.jobs.report import Report
    from pipelines.models import RawResponse

    meta = RawResponse(
        "bcb_sgs", "x", (FIX / "bcb_sgs_meta_24363.xml").read_bytes(), "text/xml", None
    )
    monkeypatch.setattr(bcb_sgs, "fetch_metadata", lambda codigo: meta)

    def nao_chamar(*a, **k):
        raise AssertionError("não deveria buscar os dados")

    monkeypatch.setattr(bcb_sgs, "fetch", nao_chamar)
    s = _series(
        id="bcb_sgs_24363",
        codigo_externo="24363",
        na_fonte={
            "nome": "Índice de Atividade Econômica do Banco Central - IBC-Br",
            "unidade": "Var. %",  # o config diz uma coisa, a fonte declara "Índice"
            "periodicidade": "M",
        },
    )
    store = _Store()
    with pytest.raises(ValidationError, match=r"unidade: esperado 'Var\. %'"):
        job.collect_sgs(None, store, Report(), s, date(2026, 11, 2))
    assert store.salvos == ["sgs_24363_metadados"]  # só a resposta bruta, para diagnóstico
