"""Eleições 2026: leitura dos arquivos do TSE, conferências e casamento TSE → IBGE.

As amostras em fixtures/ são linhas reais dos arquivos do TSE gerados em 01/11/2026
(Acrelândia/AC, Boa Saúde/RN e Iquitos, no exterior). Na amostra de candidaturas só
estão as colunas que o código lê; nenhum dado pessoal entra no repositório.
"""

import dataclasses
import gzip
from pathlib import Path

import pytest

from pipelines import config
from pipelines.jobs.eleicoes import check_turnos, check_vagas, content_hash
from pipelines.models import ValidationError
from pipelines.sources import ibge_localidades, tse
from pipelines.sources.ibge_localidades import Municipio

FIX = Path(__file__).parent / "fixtures"


def _gz(name: str) -> bytes:
    return gzip.compress((FIX / name).read_bytes(), mtime=0)


APURACAO = _gz("tse_apuracao_amostra.csv")
VOTOS = _gz("tse_votos_presidente_amostra.csv")
CANDIDATOS = _gz("tse_candidatos_amostra.csv")


def test_apuracao_soma_zonas_e_confere_identidades():
    ap = tse.parse_apuracao(APURACAO, "PRESIDENTE")
    assert {(a.nome_municipio_tse, a.turno) for a in ap} >= {("BOA SAÚDE", 1), ("BOA SAÚDE", 2)}
    for a in ap:
        assert a.aptos == a.comparecimento + a.abstencoes + a.aptos_secoes_nao_instaladas
        assert a.comparecimento == a.validos + a.brancos + a.nulos
    # no exterior, seção não instalada: aptos sem comparecimento nem abstenção
    assert any(a.uf == "ZZ" and a.aptos_secoes_nao_instaladas > 0 for a in ap)
    assert all(len(a.cd_municipio_tse) == 5 for a in ap)


def test_apuracao_recusa_linha_que_nao_fecha():
    texto = gzip.decompress(APURACAO).decode("latin-1").splitlines()
    cab = texto[0].split(";")
    linha = texto[1].split(";")
    i = cab.index('"QT_VOTOS_BRANCOS"')
    linha[i] = f'"{int(linha[i].strip(chr(34))) + 1}"'
    corpo = "\n".join([texto[0], ";".join(linha)]).encode("latin-1")
    with pytest.raises(ValidationError, match="comparecimento"):
        tse.parse_apuracao(gzip.compress(corpo), "PRESIDENTE")


def test_votos_batem_com_validos_mesmo_sem_zeros_no_codigo():
    ap = tse.parse_apuracao(APURACAO, "PRESIDENTE")
    votos = tse.parse_votos(VOTOS, "PRESIDENTE")
    # o arquivo de votos escreve "1120"; o de apuração, "01120"
    assert "01120" in {v.cd_municipio_tse for v in votos}
    tse.check_votos_batem(ap, votos)
    um_a_mais = [dataclasses.replace(votos[0], votos=votos[0].votos + 1), *votos[1:]]
    with pytest.raises(ValidationError, match="válidos"):
        tse.check_votos_batem(ap, um_a_mais)


def test_candidatos_sem_dados_pessoais_e_presidente_em_br():
    cands = tse.parse_candidatos(CANDIDATOS, {"PRESIDENTE", "GOVERNADOR"})
    campos = {f.name for f in dataclasses.fields(tse.Candidato)}
    assert not campos & {"cpf", "email", "titulo", "nascimento"}
    assert {c.uf for c in cands if c.cargo == "PRESIDENTE"} == {"BR"}
    assert all(c.sg_federacao != "#NULO" for c in cands)
    eleitos = [c for c in cands if c.situacao == "ELEITO"]
    assert {c.cargo for c in eleitos} == {"PRESIDENTE", "GOVERNADOR"}


def test_vagas_conferidas():
    cands = tse.parse_candidatos(CANDIDATOS, {"PRESIDENTE", "GOVERNADOR"})
    check_vagas(cands, {"PRESIDENTE": 1, "GOVERNADOR": 1})  # amostra só tem o RN
    with pytest.raises(ValidationError, match="eleitos"):
        check_vagas(cands, {"PRESIDENTE": 1, "GOVERNADOR": 27})


def test_turnos_conferidos_com_o_registro():
    e = config.load_eleicao()
    ap = tse.parse_apuracao(APURACAO, "PRESIDENTE")
    check_turnos(ap, e)
    errado = e.model_copy(update={"turnos": e.turnos[:1]})
    with pytest.raises(ValidationError, match="turnos"):
        check_turnos(ap, errado)


def test_hash_muda_quando_os_numeros_mudam():
    ap = tse.parse_apuracao(APURACAO, "PRESIDENTE")
    assert content_hash(ap) == content_hash(list(ap))
    outro = [dataclasses.replace(ap[0], brancos=ap[0].brancos + 1), *ap[1:]]
    assert content_hash(outro) != content_hash(ap)


# --- casamento TSE → IBGE ---

IBGE = [
    Municipio(1200013, "Acrelândia", "AC"),
    Municipio(2405306, "Januário Cicco", "RN"),
    Municipio(3165206, "São Tomé das Letras", "MG"),
]


def test_casamento_por_nome_e_por_excecao():
    tse_mun = {
        "01120": ("AC", "ACRELÂNDIA"),
        "17035": ("RN", "BOA SAÚDE"),
        "53031": ("MG", "SÃO THOMÉ DAS LETRAS"),
    }
    exc = {"17035": 2405306, "53031": 3165206}
    out = ibge_localidades.casar_tse(IBGE, tse_mun, exc)
    assert out == {
        "01120": (1200013, "nome"),
        "17035": (2405306, "excecao"),
        "53031": (3165206, "excecao"),
    }


def test_casamento_falha_sem_par_ou_em_outra_uf():
    with pytest.raises(ValidationError, match="sem par"):
        ibge_localidades.casar_tse(IBGE, {"17035": ("RN", "BOA SAÚDE")}, {})
    with pytest.raises(ValidationError, match="outra UF"):
        ibge_localidades.casar_tse(IBGE, {"17035": ("SP", "BOA SAÚDE")}, {"17035": 2405306})
    with pytest.raises(ValidationError, match="um para um"):
        ibge_localidades.casar_tse(
            IBGE,
            {"17035": ("RN", "BOA SAÚDE"), "99999": ("RN", "JANUÁRIO CICCO")},
            {"17035": 2405306},
        )


def test_registro_das_excecoes():
    e = config.load_eleicao()
    assert len(e.municipios_excecoes) == 13
    assert e.vagas["DEPUTADO FEDERAL"] == 513
    with pytest.raises(ValueError, match="mesmo IBGE"):
        config.Eleicao(**{**e.model_dump(), "municipios_excecoes": {"00001": 1, "00002": 1}})
