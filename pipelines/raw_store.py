"""Armazenamento das respostas brutas, antes de qualquer transformação (docs/06).

Cada resposta vira dois objetos: o corpo exatamente como veio da fonte e um
`.meta.json` com URL, data da coleta, tipo de conteúdo e hash SHA-256.
O caminho devolvido por `save` vai para `observations.raw_object`.

* SupabaseRawStore: bucket privado `raw` do Supabase Storage (produção e local).
* LocalRawStore: pasta no disco, para desenvolvimento sem Supabase e testes.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Protocol
from urllib.parse import urlsplit

import httpx

from pipelines.models import RawResponse


class RawStore(Protocol):
    def save(self, raw: RawResponse, name: str) -> str: ...

    def read(self, ref: str) -> bytes:
        """Conteúdo de um objeto pelo endereço que `save` devolveu (auditoria)."""
        ...


def object_path(raw: RawResponse, name: str) -> tuple[str, str]:
    digest = hashlib.sha256(raw.body).hexdigest()
    ts = raw.fetched_at.strftime("%Y/%m/%d/%H%M%SZ")
    ext = "json" if "json" in raw.content_type else "bin"
    return f"{raw.source_id}/{ts}_{name}_{digest[:12]}.{ext}", digest


def _meta(raw: RawResponse, digest: str) -> bytes:
    return json.dumps(
        {
            "source_id": raw.source_id,
            "url": raw.url,
            "fetched_at": raw.fetched_at.isoformat(),
            "content_type": raw.content_type,
            "sha256": digest,
            "bytes": len(raw.body),
        },
        ensure_ascii=False,
        indent=2,
    ).encode()


class LocalRawStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def save(self, raw: RawResponse, name: str) -> str:
        path, digest = object_path(raw, name)
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw.body)
        target.with_name(target.name + ".meta.json").write_bytes(_meta(raw, digest))
        return f"local://{path}"

    def read(self, ref: str) -> bytes:
        if not ref.startswith("local://"):
            raise RuntimeError(f"objeto em outro armazenamento: {ref}")
        return (self.root / ref.removeprefix("local://")).read_bytes()


class SupabaseRawStore:
    def __init__(self, url: str, service_key: str, bucket: str = "raw") -> None:
        self.base = url.rstrip("/")
        self.bucket = bucket
        self.headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}

    def _upload(self, client: httpx.Client, path: str, body: bytes, content_type: str) -> None:
        response = client.post(
            f"{self.base}/storage/v1/object/{self.bucket}/{path}",
            content=body,
            headers={**self.headers, "Content-Type": content_type, "x-upsert": "false"},
        )
        if response.status_code >= 400 and '"Duplicate"' in response.text:
            # O caminho leva o horário (segundo) e o hash do conteúdo: se já existe, é o mesmo
            # arquivo, gravado por outra coleta no mesmo segundo (ex.: períodos de uma tabela
            # pedidos por dois grupos de séries). Nada a fazer.
            return
        if response.status_code >= 400:
            raise RuntimeError(
                f"falha ao gravar {path} no Storage: {response.status_code} {response.text}"
            )

    def save(self, raw: RawResponse, name: str) -> str:
        path, digest = object_path(raw, name)
        with httpx.Client(timeout=60) as client:
            self._upload(client, path, raw.body, raw.content_type)
            self._upload(client, path + ".meta.json", _meta(raw, digest), "application/json")
        return f"storage://{self.bucket}/{path}"

    def read(self, ref: str) -> bytes:
        prefixo = f"storage://{self.bucket}/"
        if not ref.startswith(prefixo):
            raise RuntimeError(f"objeto em outro armazenamento: {ref}")
        with httpx.Client(timeout=60) as client:
            response = client.get(
                f"{self.base}/storage/v1/object/{self.bucket}/{ref.removeprefix(prefixo)}",
                headers=self.headers,
            )
        if response.status_code >= 400:
            raise RuntimeError(f"falha ao ler {ref}: {response.status_code} {response.text}")
        return response.content


def from_env() -> RawStore:
    """RAW_STORE=supabase|local. Sem valor: Supabase se houver credenciais, senão disco."""
    mode = os.environ.get("RAW_STORE", "").lower()
    # strip: segredo colado no painel costuma vir com uma quebra de linha no fim.
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if mode == "supabase" or (not mode and url and key):
        if not (url and key):
            raise RuntimeError("RAW_STORE=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY")
        if urlsplit(url).path.strip("/"):
            # Engano comum: copiar a URL da API REST (.../rest/v1/) no lugar da do projeto.
            raise RuntimeError(
                "SUPABASE_URL deve ser só o endereço do projeto (https://<ref>.supabase.co), "
                "sem caminho no final como /rest/v1/"
            )
        return SupabaseRawStore(url, key)
    return LocalRawStore(Path(os.environ.get("RAW_DIR", "data/raw")))
