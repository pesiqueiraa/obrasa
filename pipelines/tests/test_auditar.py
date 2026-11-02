"""Auditoria das respostas brutas (pipelines/jobs/auditar.py)."""

from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest

from pipelines import config
from pipelines.jobs import auditar
from pipelines.models import RawResponse, ValidationError
from pipelines.raw_store import LocalRawStore

FIX = Path(__file__).parent / "fixtures"


def _gravado(tmp_path, nome="bcb_sgs_433.json"):
    store = LocalRawStore(tmp_path)
    body = (FIX / nome).read_bytes()
    raw = RawResponse("bcb_sgs", "https://x", body, "application/json", datetime.now(UTC))
    return store, store.save(raw, "sgs_433")


def _serie(sid):
    return next(s for s in config.load().series if s.id == sid)


def test_bruto_intacto_passa_e_relido_bate(tmp_path):
    store, ref = _gravado(tmp_path)
    body = store.read(ref)
    auditar.confere_hash(ref, body, store.read(ref + ".meta.json"))
    relido = auditar.valores_serie(body, _serie("bcb_sgs_433"))
    ultimo = max(relido)
    assert auditar.compara(ref, [("bcb_sgs_433", ultimo, relido[ultimo])], relido) == []


def test_arquivo_adulterado_e_detectado(tmp_path):
    store, ref = _gravado(tmp_path)
    alvo = tmp_path / ref.removeprefix("local://")
    alvo.write_bytes(alvo.read_bytes().replace(b'"0.', b'"1.', 1))
    with pytest.raises(ValidationError, match="hash mudou"):
        auditar.confere_hash(ref, store.read(ref), store.read(ref + ".meta.json"))


def test_valor_do_banco_diferente_do_bruto(tmp_path):
    store, ref = _gravado(tmp_path)
    relido = auditar.valores_serie(store.read(ref), _serie("bcb_sgs_433"))
    ultimo = max(relido)
    erros = auditar.compara(ref, [("bcb_sgs_433", ultimo, relido[ultimo] + 1)], relido)
    assert len(erros) == 1 and "banco" in erros[0]


def test_periodo_que_nao_esta_no_bruto(tmp_path):
    store, ref = _gravado(tmp_path)
    relido = auditar.valores_serie(store.read(ref), _serie("bcb_sgs_433"))
    erros = auditar.compara(ref, [("bcb_sgs_433", date(1900, 1, 1), Decimal(1))], relido)
    assert "não está na resposta bruta" in erros[0]


def test_ibge_relido_com_varias_variaveis():
    body = (FIX / "ibge_1737_63_2265_2266.json").read_bytes()
    relido = auditar.valores_serie(body, _serie("ibge_agregados_1737_2265"))
    assert relido and all(isinstance(v, Decimal) for v in relido.values())


def test_armazenamento_errado_e_recusado(tmp_path):
    with pytest.raises(RuntimeError, match="outro armazenamento"):
        LocalRawStore(tmp_path).read("storage://raw/x.json")
