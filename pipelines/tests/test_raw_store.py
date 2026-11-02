def test_supabase_url_com_caminho_e_recusada(monkeypatch):
    import pytest

    from pipelines import raw_store

    monkeypatch.setenv("RAW_STORE", "supabase")
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co/rest/v1/")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "x")
    with pytest.raises(RuntimeError, match="sem caminho"):
        raw_store.from_env()
