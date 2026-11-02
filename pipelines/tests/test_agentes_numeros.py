"""Verificador de números dos agentes (pipelines/agentes/numeros.py)."""

from pipelines.agentes.numeros import Lastro, leituras, verifica

SAIDA = (
    '{"colunas": ["ref_date", "value"], "linhas": [["2026-09-01", "0.82"], '
    '["2026-10-26", "5.5007"], ["2026-08-01", "3790"]]}'
)
LASTRO = Lastro.de([SAIDA, "bcb_sgs_24363: unidade esperado 'Var. %'"])


def test_numero_copiado_da_ferramenta_passa_nos_dois_formatos():
    assert verifica("O IPCA de set/2026 foi 0,82%.", LASTRO) == []
    assert verifica("valor 0.82 em 2026-09-01", LASTRO) == []
    assert verifica("o dólar fechou a R$ 5,5007 em 26/10/2026", LASTRO) == []
    assert verifica("rendimento de R$ 3.790", LASTRO) == []  # milhar brasileiro


def test_numero_inventado_ou_arredondado_e_recusado():
    assert [p.trecho for p in verifica("o IPCA foi 0,83%", LASTRO)] == ["0,83"]
    assert [p.trecho for p in verifica("cerca de 0,8%", LASTRO)] == ["0,8"]
    assert [p.trecho for p in verifica("o dólar subiu 9,2%", LASTRO)] == ["9,2"]


def test_data_e_mes_sem_lastro_sao_recusados():
    motivos = {p.trecho: p.motivo for p in verifica("em 27/10/2026 e em out/2025", LASTRO)}
    assert set(motivos) == {"27/10/2026", "out/2025"}
    assert verifica("data 31/02/2026", LASTRO)[0].motivo == "data inválida"


def test_contagens_pequenas_ficam_de_fora():
    assert verifica("2 períodos, passo 3, 10 séries", LASTRO) == []
    assert verifica("11 séries", LASTRO)[0].trecho == "11"
    assert verifica("2,5 pontos", LASTRO)[0].trecho == "2,5"


def test_identificadores_precisam_vir_da_entrada():
    assert verifica("a série bcb_sgs_24363 mudou", LASTRO) == []
    assert verifica("a série bcb_sgs_24364 mudou", LASTRO)[0].trecho == "24364"


def test_leituras_ambiguas():
    assert leituras("1.234") == {"1.234", "1234"}
    assert leituras("1,234") == {"1.234", "1234"}
    assert leituras("1.234,56") == {"1234.56"}
    assert leituras("5,20") == {"5.2"}
    assert leituras("1.2.3") == set()
