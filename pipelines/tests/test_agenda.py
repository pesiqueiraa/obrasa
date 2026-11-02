import json
from datetime import date

import pytest

from pipelines.config import Copom, load_copom
from pipelines.jobs.agenda import confere, decisoes_publicadas
from pipelines.models import ValidationError


def corpo(*pares):
    return json.dumps(
        {"conteudo": [{"nro_reuniao": n, "dataReferencia": d, "titulo": "x"} for n, d in pares]}
    ).encode()


CFG = Copom(
    fonte="https://www.bcb.gov.br/controleinflacao/calendarioreunioescopom",
    reunioes=[
        {"numero": 280, "inicio": "2026-08-04", "decisao": "2026-08-05"},
        {"numero": 281, "inicio": "2026-09-15", "decisao": "2026-09-16"},
        {"numero": 282, "inicio": "2026-11-03", "decisao": "2026-11-04"},
    ],
)


def test_le_comunicados():
    assert decisoes_publicadas(corpo((281, "2026-09-16"))) == {281: date(2026, 9, 16)}


def test_comunicados_fora_do_formato():
    with pytest.raises(ValidationError):
        decisoes_publicadas(b"<html>")
    with pytest.raises(ValidationError):
        decisoes_publicadas(b'{"conteudo": [{"nro_reuniao": 1}]}')


def test_confere_so_reunioes_passadas():
    pub = decisoes_publicadas(corpo((281, "2026-09-16"), (280, "2026-08-05")))
    assert confere(CFG, pub, date(2026, 11, 2)) == [280, 281]


def test_data_divergente_falha():
    pub = decisoes_publicadas(corpo((281, "2026-09-17"), (280, "2026-08-05")))
    with pytest.raises(ValidationError, match="281"):
        confere(CFG, pub, date(2026, 11, 2))


def test_reuniao_passada_sem_comunicado_falha():
    pub = decisoes_publicadas(corpo((280, "2026-08-05")))
    with pytest.raises(ValidationError, match="281"):
        confere(CFG, pub, date(2026, 11, 2))


def test_config_ordenada():
    with pytest.raises(ValueError):
        Copom(fonte="x", reunioes=list(reversed(CFG.reunioes)))
    with pytest.raises(ValueError):
        Copom(fonte="x", reunioes=[{"numero": 1, "inicio": "2026-01-01", "decisao": "2026-01-09"}])


def test_config_do_repositorio_carrega():
    assert load_copom().reunioes
