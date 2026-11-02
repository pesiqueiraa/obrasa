def test_supabase_url_com_caminho_e_recusada(monkeypatch):
    import pytest

    from pipelines import raw_store

    monkeypatch.setenv("RAW_STORE", "supabase")
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co/rest/v1/")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "x")
    with pytest.raises(RuntimeError, match="sem caminho"):
        raw_store.from_env()


def test_segredos_com_quebra_de_linha_no_fim(monkeypatch, tmp_path):
    from pipelines import raw_store

    monkeypatch.setenv("RAW_STORE", "supabase")
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co\n")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "x\n")
    assert isinstance(raw_store.from_env(), raw_store.SupabaseRawStore)
