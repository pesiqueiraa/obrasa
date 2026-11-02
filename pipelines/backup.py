"""Cópia de segurança fora do Supabase (docs/06, "Cópia de segurança").

Uso (workflow .github/workflows/backup.yml, semanal):
  uv run python -m pipelines.backup contagens > contagens.json
  pg_dump ... -Fc -n public -f banco.dump
  uv run python -m pipelines.backup copiar banco.dump contagens.json
  uv run python -m pipelines.backup baixar-ultimo restaurado.dump manifesto.json
  pg_restore ... restaurado.dump        # num Postgres vazio
  RESTAURO_URL=... uv run python -m pipelines.backup conferir manifesto.json

O que vai para o destino:
  banco/AAAA-MM-DD.dump   pg_dump do schema public (formato custom), últimas 12 semanas
  banco/AAAA-MM-DD.json   manifesto: contagem de linhas por tabela antes do dump, SHA-256
  brutos/<caminho>        cada resposta bruta do bucket `raw`, uma vez só (o caminho leva
                          o hash do conteúdo, então o arquivo nunca muda)

O restauro é testado a cada cópia: o dump volta do destino, é restaurado num Postgres
vazio e cada tabela precisa ter pelo menos as linhas contadas antes do dump. As tabelas
de dado só aceitam INSERT, então a contagem só cresce entre a contagem e o dump.

Destino: BACKUP_DESTINO=r2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
R2_BUCKET) ou BACKUP_DESTINO=pasta (BACKUP_DIR, para teste local).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

import httpx
import psycopg
from psycopg import sql

from pipelines import db, raw_store

MANTER_DUMPS = 12
_HASH_NO_NOME = re.compile(r"_([0-9a-f]{12})\.\w+$")


class Destino(Protocol):
    def chaves(self, prefixo: str) -> set[str]: ...
    def grava(self, chave: str, corpo: bytes) -> None: ...
    def le(self, chave: str) -> bytes: ...
    def apaga(self, chave: str) -> None: ...


class PastaDestino:
    def __init__(self, raiz: Path) -> None:
        self.raiz = raiz

    def chaves(self, prefixo: str) -> set[str]:
        base = self.raiz / prefixo
        if not base.exists():
            return set()
        return {p.relative_to(self.raiz).as_posix() for p in base.rglob("*") if p.is_file()}

    def grava(self, chave: str, corpo: bytes) -> None:
        alvo = self.raiz / chave
        alvo.parent.mkdir(parents=True, exist_ok=True)
        alvo.write_bytes(corpo)

    def le(self, chave: str) -> bytes:
        return (self.raiz / chave).read_bytes()

    def apaga(self, chave: str) -> None:
        (self.raiz / chave).unlink()


class R2Destino:
    """Bucket do Cloudflare R2 pela API compatível com S3."""

    def __init__(self, conta: str, chave_id: str, segredo: str, bucket: str) -> None:
        import boto3  # só no workflow de backup (grupo `backup` do pyproject)

        self.bucket = bucket
        self.s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{conta}.r2.cloudflarestorage.com",
            aws_access_key_id=chave_id,
            aws_secret_access_key=segredo,
            region_name="auto",
        )

    def chaves(self, prefixo: str) -> set[str]:
        achadas: set[str] = set()
        for pagina in self.s3.get_paginator("list_objects_v2").paginate(
            Bucket=self.bucket, Prefix=prefixo
        ):
            achadas |= {o["Key"] for o in pagina.get("Contents", [])}
        return achadas

    def grava(self, chave: str, corpo: bytes) -> None:
        self.s3.put_object(Bucket=self.bucket, Key=chave, Body=corpo)

    def le(self, chave: str) -> bytes:
        return self.s3.get_object(Bucket=self.bucket, Key=chave)["Body"].read()

    def apaga(self, chave: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=chave)


def destino_do_ambiente() -> Destino:
    modo = os.environ.get("BACKUP_DESTINO", "")
    if modo == "r2":
        # strip: segredo colado no painel costuma vir com uma quebra de linha no fim.
        e = {k: v.strip() for k, v in os.environ.items() if k.startswith("R2_")}
        return R2Destino(
            e["R2_ACCOUNT_ID"], e["R2_ACCESS_KEY_ID"], e["R2_SECRET_ACCESS_KEY"], e["R2_BUCKET"]
        )
    if modo == "pasta":
        return PastaDestino(Path(os.environ.get("BACKUP_DIR", "data/backup")))
    raise RuntimeError("defina BACKUP_DESTINO=r2 ou BACKUP_DESTINO=pasta")


# --- respostas brutas ---


def lista_storage(store: raw_store.SupabaseRawStore, prefixo: str = "") -> list[str]:
    """Todos os objetos do bucket, percorrendo as pastas (a API lista um nível por vez)."""
    caminhos: list[str] = []
    with httpx.Client(timeout=60) as client:
        pendentes = [prefixo]
        while pendentes:
            pasta = pendentes.pop()
            inicio = 0
            while True:
                r = client.post(
                    f"{store.base}/storage/v1/object/list/{store.bucket}",
                    headers=store.headers,
                    json={"prefix": pasta, "limit": 1000, "offset": inicio},
                )
                r.raise_for_status()
                itens = r.json()
                for item in itens:
                    caminho = f"{pasta}/{item['name']}" if pasta else item["name"]
                    (caminhos if item.get("id") else pendentes).append(caminho)
                if len(itens) < 1000:
                    break
                inicio += 1000
    return sorted(caminhos)


def confere_hash(caminho: str, corpo: bytes) -> None:
    """O nome do arquivo leva os 12 primeiros caracteres do SHA-256 do corpo."""
    m = _HASH_NO_NOME.search(caminho)
    if caminho.endswith(".meta.json") or not m:
        return
    if hashlib.sha256(corpo).hexdigest()[:12] != m[1]:
        raise RuntimeError(f"corpo de {caminho} não bate com o hash do nome")


def copia_brutos(store: raw_store.SupabaseRawStore, destino: Destino) -> tuple[int, int]:
    """Copia o que ainda não está no destino. Devolve (copiados, já existiam)."""
    existentes = destino.chaves("brutos/")
    copiados = 0
    caminhos = lista_storage(store)
    for caminho in caminhos:
        chave = f"brutos/{caminho}"
        if chave in existentes:
            continue
        corpo = store.read(f"storage://{store.bucket}/{caminho}")
        confere_hash(caminho, corpo)
        destino.grava(chave, corpo)
        copiados += 1
    return copiados, len(caminhos) - copiados


# --- banco ---


def contagens(conn: psycopg.Connection) -> dict[str, int]:
    tabelas = [
        r[0]
        for r in conn.execute(
            "select table_name from information_schema.tables "
            "where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"
        ).fetchall()
    ]
    return {
        t: conn.execute(sql.SQL("select count(*) from {}").format(sql.Identifier(t))).fetchone()[0]
        for t in tabelas
    }


def copia_banco(
    destino: Destino, dump: Path, antes: dict[str, int], hoje: datetime | None = None
) -> str:
    hoje = hoje or datetime.now(UTC)
    corpo = dump.read_bytes()
    if not corpo.startswith(b"PGDMP"):
        raise RuntimeError(f"{dump} não é um pg_dump em formato custom")
    nome = f"banco/{hoje:%Y-%m-%d}"
    manifesto = {
        "criado_em": hoje.isoformat(timespec="seconds"),
        "bytes": len(corpo),
        "sha256": hashlib.sha256(corpo).hexdigest(),
        "contagens": antes,
    }
    destino.grava(f"{nome}.dump", corpo)
    destino.grava(f"{nome}.json", json.dumps(manifesto, indent=2).encode())
    return nome


def poda(destino: Destino, manter: int = MANTER_DUMPS) -> list[str]:
    """Apaga os dumps mais antigos além dos `manter` mais recentes. Brutos nunca são apagados."""
    datas = sorted({k.removeprefix("banco/").split(".")[0] for k in destino.chaves("banco/")})
    apagados = []
    for data in datas[:-manter] if len(datas) > manter else []:
        for ext in ("dump", "json"):
            chave = f"banco/{data}.{ext}"
            destino.apaga(chave)
            apagados.append(chave)
    return apagados


def baixa_ultimo(destino: Destino, dump: Path, manifesto: Path) -> str:
    datas = sorted({k.removeprefix("banco/").split(".")[0] for k in destino.chaves("banco/")})
    if not datas:
        raise RuntimeError("nenhum dump no destino")
    nome = f"banco/{datas[-1]}"
    corpo = destino.le(f"{nome}.dump")
    meta = json.loads(destino.le(f"{nome}.json"))
    if hashlib.sha256(corpo).hexdigest() != meta["sha256"]:
        raise RuntimeError(f"{nome}.dump não bate com o SHA-256 do manifesto")
    dump.write_bytes(corpo)
    manifesto.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return nome


def confere_restauro(depois: dict[str, int], manifesto: dict) -> list[str]:
    """Cada tabela restaurada tem pelo menos as linhas contadas antes do dump."""
    problemas = []
    for tabela, antes in manifesto["contagens"].items():
        if tabela not in depois:
            problemas.append(f"{tabela}: não existe no banco restaurado")
        elif depois[tabela] < antes:
            problemas.append(f"{tabela}: {depois[tabela]} linhas restauradas, {antes} antes")
    return problemas


def main(argv: list[str]) -> int:
    match argv:
        case ["contagens"]:
            with db.connect() as conn:
                print(json.dumps(contagens(conn), indent=2))
        case ["copiar", dump, antes]:
            destino = destino_do_ambiente()
            nome = copia_banco(destino, Path(dump), json.loads(Path(antes).read_text()))
            store = raw_store.from_env()
            if not isinstance(store, raw_store.SupabaseRawStore):
                raise RuntimeError("a cópia dos brutos lê o Supabase Storage (RAW_STORE=supabase)")
            copiados, existiam = copia_brutos(store, destino)
            apagados = poda(destino)
            print(f"{nome}: dump gravado; brutos: {copiados} novos, {existiam} já copiados; "
                  f"{len(apagados)} arquivos antigos apagados")  # fmt: skip
        case ["baixar-ultimo", dump, manifesto]:
            print(f"baixado: {baixa_ultimo(destino_do_ambiente(), Path(dump), Path(manifesto))}")
        case ["conferir", manifesto]:
            with psycopg.connect(os.environ["RESTAURO_URL"], autocommit=True) as conn:
                problemas = confere_restauro(
                    contagens(conn), json.loads(Path(manifesto).read_text())
                )
            for p in problemas:
                print(f"ERRO: {p}", file=sys.stderr)
            if problemas:
                return 1
            print("restauro conferido: todas as tabelas com as linhas esperadas")
        case _:
            print(__doc__)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
