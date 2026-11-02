"""Cópia de segurança (pipelines/backup.py) com destino em pasta e Storage falso."""

import hashlib
import json
from datetime import UTC, datetime, timedelta

import pytest

from pipelines import backup


@pytest.fixture
def destino(tmp_path):
    return backup.PastaDestino(tmp_path / "destino")


def _dump(tmp_path, corpo=b"PGDMP-conteudo"):
    p = tmp_path / "banco.dump"
    p.write_bytes(corpo)
    return p


def test_copia_banco_grava_dump_e_manifesto(destino, tmp_path):
    nome = backup.copia_banco(destino, _dump(tmp_path), {"observations": 3})
    meta = json.loads(destino.le(f"{nome}.json"))
    assert meta["contagens"] == {"observations": 3}
    assert meta["sha256"] == hashlib.sha256(b"PGDMP-conteudo").hexdigest()


def test_recusa_arquivo_que_nao_e_dump(destino, tmp_path):
    with pytest.raises(RuntimeError, match="pg_dump"):
        backup.copia_banco(destino, _dump(tmp_path, b"<html>erro</html>"), {})


def test_poda_mantem_os_mais_recentes(destino, tmp_path):
    inicio = datetime(2026, 1, 4, tzinfo=UTC)
    for semana in range(14):
        backup.copia_banco(destino, _dump(tmp_path), {}, inicio + timedelta(weeks=semana))
    apagados = backup.poda(destino)
    assert sorted(apagados) == [
        "banco/2026-01-04.dump",
        "banco/2026-01-04.json",
        "banco/2026-01-11.dump",
        "banco/2026-01-11.json",
    ]
    assert len(destino.chaves("banco/")) == 24


def test_baixa_ultimo_confere_o_sha(destino, tmp_path):
    nome = backup.copia_banco(destino, _dump(tmp_path), {"x": 1})
    assert backup.baixa_ultimo(destino, tmp_path / "r.dump", tmp_path / "m.json") == nome
    destino.grava(f"{nome}.dump", b"PGDMP-alterado")
    with pytest.raises(RuntimeError, match="SHA-256"):
        backup.baixa_ultimo(destino, tmp_path / "r.dump", tmp_path / "m.json")


def test_confere_restauro():
    manifesto = {"contagens": {"observations": 10, "corrections": 0, "news_articles": 5}}
    assert backup.confere_restauro({"observations": 12, "corrections": 0, "news_articles": 5}, manifesto) == []  # fmt: skip
    problemas = backup.confere_restauro({"observations": 9, "corrections": 0}, manifesto)
    assert problemas == [
        "observations: 9 linhas restauradas, 10 antes",
        "news_articles: não existe no banco restaurado",
    ]


def test_confere_hash_do_nome():
    corpo = b'{"a": 1}'
    h = hashlib.sha256(corpo).hexdigest()[:12]
    backup.confere_hash(f"bcb_sgs/2026/11/02/x_sgs_433_{h}.json", corpo)
    backup.confere_hash(f"bcb_sgs/2026/11/02/x_sgs_433_{h}.json.meta.json", b"outro")
    with pytest.raises(RuntimeError, match="hash"):
        backup.confere_hash(f"bcb_sgs/2026/11/02/x_sgs_433_{h}.json", b"trocado")


def test_copia_brutos_so_o_que_falta(destino, monkeypatch):
    corpo = b"[1]"
    h = hashlib.sha256(corpo).hexdigest()[:12]
    caminhos = [f"bcb_sgs/a_{h}.json", f"bcb_sgs/a_{h}.json.meta.json"]

    class Store:
        bucket = "raw"

        def read(self, ref):
            return corpo if not ref.endswith(".meta.json") else b"{}"

    monkeypatch.setattr(backup, "lista_storage", lambda store: caminhos)
    assert backup.copia_brutos(Store(), destino) == (2, 0)
    assert backup.copia_brutos(Store(), destino) == (0, 2)
    assert destino.le(f"brutos/bcb_sgs/a_{h}.json") == corpo
