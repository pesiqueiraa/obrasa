"""Eleições 2026: leitura dos arquivos do TSE, conferências e casamento TSE → IBGE.

As amostras em fixtures/ são linhas reais dos arquivos do TSE gerados em 01/11/2026
(Acrelândia/AC, Boa Saúde/RN e Iquitos, no exterior). Na amostra de candidaturas só
estão as colunas que o código lê; nenhum dado pessoal entra no repositório.
"""

import dataclasses
import gzip
import io
import os
import zipfile
from pathlib import Path

import httpx
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


# --- leitura do zip por partes (HTTP Range) ---------------------------------------


def _zip(conteudo: bytes, extra: bytes = b"") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("dados_BR.csv", conteudo)
        z.writestr("leiame.pdf", extra or os.urandom(3 << 20))  # força várias partes
    return buf.getvalue()


class _CDN:
    """Servidor falso com Range e If-Range. `trocas` diz após quantos GETs o arquivo
    passa para a versão seguinte; `ignora_if_range` imita um CDN que não confere ETag."""

    def __init__(self, versoes: list[bytes], trocas: list[int], ignora_if_range=False):
        self.versoes, self.trocas, self.ignora = versoes, trocas, ignora_if_range
        self.v, self.gets = 0, 0

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if self.trocas and self.gets >= self.trocas[0]:
            self.trocas.pop(0)
            self.v += 1
        corpo, etag = self.versoes[self.v], f'"v{self.v}"'
        base = {"accept-ranges": "bytes", "etag": etag}
        if request.method == "HEAD":
            return httpx.Response(200, headers={**base, "content-length": str(len(corpo))})
        self.gets += 1
        if_range = request.headers.get("if-range")
        if if_range and if_range != etag and not self.ignora:
            return httpx.Response(200, headers=base, content=corpo)
        ini, fim = (int(x) for x in request.headers["range"].removeprefix("bytes=").split("-"))
        fim = min(fim, len(corpo) - 1)
        headers = {**base, "content-range": f"bytes {ini}-{fim}/{len(corpo)}"}
        return httpx.Response(206, headers=headers, content=corpo[ini : fim + 1])


def _fetch(cdn: _CDN, attempts: int = 2):
    client = httpx.Client(transport=httpx.MockTransport(cdn))
    return tse.fetch_member(
        "https://cdn.test/a.zip", "dados_BR.csv", client, attempts, lambda _: None
    )


def test_zip_lido_por_partes():
    raw = _fetch(_CDN([_zip(b"a;b\n1;2\n")], []))
    assert gzip.decompress(raw.body) == b"a;b\n1;2\n"


def test_zip_que_muda_no_meio_da_leitura_recomeca():
    cdn = _CDN([_zip(b"velho"), _zip(b"novo")], [1])
    raw = _fetch(cdn)
    assert gzip.decompress(raw.body) == b"novo"


def test_cdn_sem_if_range_e_pego_pelo_tamanho():
    cdn = _CDN([_zip(b"velho"), _zip(b"novo", extra=os.urandom(4 << 20))], [1], True)
    assert gzip.decompress(_fetch(cdn).body) == b"novo"


def test_zip_que_nao_para_de_mudar_falha_com_erro_claro():
    cdn = _CDN([_zip(b"1"), _zip(b"2"), _zip(b"3")], [1, 3])
    with pytest.raises(tse.ArquivoMudou, match="mudou"):
        _fetch(cdn)
