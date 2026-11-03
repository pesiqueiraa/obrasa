"""Coletor dos arquivos de resultados do Portal de Dados Abertos do TSE. Ver docs/05.

Os zips do TSE são grandes (o de votação por candidato tem 454 MB). O servidor aceita
HTTP Range, então o zip é lido por partes: primeiro o diretório central, depois só o
arquivo pedido. O arquivo extraído é a resposta bruta guardada (comprimido em gzip).

O TSE regenera os zips e o CDN guarda cópias por horas; partes de versões diferentes
misturadas formam um zip inválido. Cada parte é pedida com o ETag da primeira resposta
(If-Range) e o tamanho total de cada parte é conferido. Se o arquivo mudou no meio da
leitura, ela recomeça do zero.

Os CSVs vêm em latin-1, separados por ";". Cada linha é um município e zona; aqui as
zonas são somadas por município. Dos arquivos de candidaturas só são lidos os campos
que a página mostra: CPF, e-mail, título de eleitor e outros dados pessoais ficam de fora.
"""

from __future__ import annotations

import csv
import gzip
import io
import time
import zipfile
from collections import defaultdict
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import httpx

from pipelines.http import RETRY_STATUS, USER_AGENT
from pipelines.models import RawResponse, ValidationError

SOURCE_ID = "tse_dados_abertos"
TZ = ZoneInfo("America/Sao_Paulo")


class ArquivoMudou(ValidationError):
    """O zip remoto mudou de versão durante a leitura por partes."""


class _RangeFile(io.RawIOBase):
    """Arquivo remoto só de leitura, buscado por HTTP Range sob demanda.

    Todas as partes têm de vir da mesma versão do arquivo: a do HEAD inicial.
    """

    def __init__(
        self,
        client: httpx.Client,
        url: str,
        attempts: int = 4,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.client, self.url, self.attempts, self.sleep = client, url, attempts, sleep
        head = self._request("HEAD", {})
        head.close()
        if head.headers.get("accept-ranges") != "bytes":
            raise ValidationError(f"{url}: o servidor não aceita HTTP Range")
        self.size = int(head.headers["content-length"])
        etag = head.headers.get("etag")
        # ETag fraco (W/) não vale em If-Range; sem ele, sobra a conferência do tamanho.
        self.etag = etag if etag and not etag.startswith("W/") else None
        self.pos = 0
        self.downloaded = 0

    def _request(self, method: str, headers: dict[str, str]) -> httpx.Response:
        """Resposta com o corpo ainda não lido (stream): quem chama lê ou fecha."""
        last: Exception | None = None
        for attempt in range(1, self.attempts + 1):
            try:
                req = self.client.build_request(method, self.url, headers=headers)
                r = self.client.send(req, stream=True)
                if r.status_code in RETRY_STATUS and attempt < self.attempts:
                    r.close()
                    self.sleep(2**attempt)
                    continue
                if r.is_error:
                    r.close()
                r.raise_for_status()
                return r
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                last = exc
                if attempt < self.attempts:
                    self.sleep(2**attempt)
        raise RuntimeError(f"{SOURCE_ID}: falha ao buscar {self.url}: {last}") from last

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        self.pos = {0: offset, 1: self.pos + offset, 2: self.size + offset}[whence]
        return self.pos

    def readinto(self, buf) -> int:  # type: ignore[override]
        if self.pos >= self.size:
            return 0
        end = min(self.pos + len(buf), self.size) - 1
        headers = {"Range": f"bytes={self.pos}-{end}"}
        if self.etag:
            headers["If-Range"] = self.etag
        r = self._request("GET", headers)
        try:
            if r.status_code == 200 and self.etag:
                # If-Range não bateu: o servidor mandaria o arquivo novo inteiro.
                raise ArquivoMudou(f"{self.url}: ETag mudou de {self.etag} durante a leitura")
            if r.status_code != 206:
                raise ValidationError(f"{self.url}: esperado 206 para Range, veio {r.status_code}")
            total = r.headers.get("content-range", "").rpartition("/")[2]
            if total != str(self.size):
                raise ArquivoMudou(
                    f"{self.url}: tamanho mudou de {self.size} para {total or '?'} bytes"
                    " durante a leitura"
                )
            data = r.read()
        finally:
            r.close()
        if len(data) != end - self.pos + 1:
            raise ValidationError(
                f"{self.url}: pedidos {end - self.pos + 1} bytes, vieram {len(data)}"
            )
        buf[: len(data)] = data
        self.pos += len(data)
        self.downloaded += len(data)
        return len(data)


def _read_member(client: httpx.Client, zip_url: str, membro: str, sleep) -> bytes:
    remote = _RangeFile(client, zip_url, sleep=sleep)
    try:
        with zipfile.ZipFile(io.BufferedReader(remote, buffer_size=1 << 20)) as z:
            if membro not in z.namelist():
                raise ValidationError(f"{zip_url}: não tem {membro}")
            return z.read(membro)
    except zipfile.BadZipFile as exc:
        raise ArquivoMudou(f"{zip_url}: zip inválido ({exc})") from exc


def fetch_member(
    zip_url: str,
    membro: str,
    client: httpx.Client | None = None,
    attempts: int = 2,
    sleep: Callable[[float], None] = time.sleep,
) -> RawResponse:
    """Baixa só `membro` de dentro do zip remoto. O corpo devolvido é o CSV em gzip.

    Se o arquivo mudar no meio da leitura (ou o zip vier inválido), recomeça do zero,
    até `attempts` vezes no total.
    """
    own = client is None
    client = client or httpx.Client(
        timeout=120, headers={"User-Agent": USER_AGENT}, follow_redirects=True
    )
    try:
        for attempt in range(1, attempts + 1):
            try:
                data = _read_member(client, zip_url, membro, sleep)
                break
            except ArquivoMudou:
                if attempt == attempts:
                    raise
                sleep(30)
        return RawResponse(
            source_id=SOURCE_ID,
            url=f"{zip_url}#{membro}",
            body=gzip.compress(data, mtime=0),
            content_type="application/gzip",
            fetched_at=datetime.now(UTC),
        )
    finally:
        if own:
            client.close()


def rows(raw_body: bytes) -> Iterator[dict[str, str]]:
    text = io.TextIOWrapper(io.BytesIO(gzip.decompress(raw_body)), encoding="latin-1")
    yield from csv.DictReader(text, delimiter=";")


def _int(d: dict[str, str], k: str) -> int:
    try:
        return int(d[k])
    except (KeyError, ValueError) as exc:
        raise ValidationError(f"campo {k} ausente ou não numérico: {d.get(k)!r}") from exc


def _municipio(d: dict[str, str]) -> str:
    """Código TSE do município com 5 dígitos. O arquivo de votação por candidato escreve
    sem os zeros à esquerda ("1007"); o de detalhe da apuração, com ("01007")."""
    cd = d["CD_MUNICIPIO"]
    if not cd.isdigit() or len(cd) > 5:
        raise ValidationError(f"código de município fora do formato: {cd!r}")
    return cd.zfill(5)


def gerado_em(raw_body: bytes) -> datetime | None:
    """Data e hora de geração do arquivo (DT_GERACAO e HH_GERACAO da primeira linha)."""
    for d in rows(raw_body):
        quando = f"{d['DT_GERACAO']} {d['HH_GERACAO']}"
        return datetime.strptime(quando, "%d/%m/%Y %H:%M:%S").replace(tzinfo=TZ)
    return None


@dataclass(frozen=True)
class Apuracao:
    cd_eleicao: int
    turno: int
    data_eleicao: date
    cargo: str
    uf: str
    cd_municipio_tse: str
    nome_municipio_tse: str
    aptos: int
    comparecimento: int
    abstencoes: int
    aptos_secoes_nao_instaladas: int
    validos: int
    brancos: int
    nulos: int


_APURACAO_COLUNAS = (
    "QT_APTOS",
    "QT_COMPARECIMENTO",
    "QT_ABSTENCOES",
    "QT_ELEITORES_SECOES_NAO_INSTALADAS",
    "QT_TOTAL_VOTOS_VALIDOS",
    "QT_VOTOS_BRANCOS",
    "QT_TOTAL_VOTOS_NULOS",
)


def parse_apuracao(raw_body: bytes, cargo: str) -> list[Apuracao]:
    """Detalhe da apuração por município (zonas somadas), só do `cargo` pedido.

    Confere, linha a linha, as duas identidades do arquivo:
      aptos = comparecimento + abstenções + eleitores de seções não instaladas
      comparecimento = válidos + brancos + nulos
    """
    soma: dict[tuple, list[int]] = defaultdict(lambda: [0] * len(_APURACAO_COLUNAS))
    for d in rows(raw_body):
        if d["DS_CARGO"].upper() != cargo:
            continue
        v = [_int(d, c) for c in _APURACAO_COLUNAS]
        aptos, comp, abst, nao_inst, val, br, nul = v
        onde = f"{d['NM_MUNICIPIO']} ({d['SG_UF']}), zona {d['NR_ZONA']}, {d['NR_TURNO']}º turno"
        if aptos != comp + abst + nao_inst:
            raise ValidationError(f"{onde}: aptos ≠ comparecimento + abstenções + não instaladas")
        if comp != val + br + nul:
            raise ValidationError(f"{onde}: comparecimento ≠ válidos + brancos + nulos")
        key = (
            int(d["CD_ELEICAO"]),
            int(d["NR_TURNO"]),
            datetime.strptime(d["DT_ELEICAO"], "%d/%m/%Y").date(),
            d["SG_UF"],
            _municipio(d),
            d["NM_MUNICIPIO"],
        )
        acc = soma[key]
        for i, x in enumerate(v):
            acc[i] += x
    if not soma:
        raise ValidationError(f"nenhuma linha de {cargo} na apuração")
    return [
        Apuracao(cd, turno, dt, cargo, uf, mun, nome, *vals)
        for (cd, turno, dt, uf, mun, nome), vals in sorted(soma.items())
    ]


@dataclass(frozen=True)
class Voto:
    turno: int
    cargo: str
    uf: str
    cd_municipio_tse: str
    nr_candidato: int
    votos: int


def parse_votos(raw_body: bytes, cargo: str) -> list[Voto]:
    """Votos válidos por candidato e município (zonas somadas)."""
    soma: dict[tuple, int] = defaultdict(int)
    for d in rows(raw_body):
        if d["DS_CARGO"].upper() != cargo:
            continue
        key = (int(d["NR_TURNO"]), d["SG_UF"], _municipio(d), _int(d, "NR_CANDIDATO"))
        soma[key] += _int(d, "QT_VOTOS_NOMINAIS_VALIDOS")
    if not soma:
        raise ValidationError(f"nenhum voto de {cargo}")
    return [Voto(t, cargo, uf, mun, nr, v) for (t, uf, mun, nr), v in sorted(soma.items())]


@dataclass(frozen=True)
class Candidato:
    turno: int
    cargo: str
    uf: str
    sq_candidato: str
    nr_candidato: int
    nome_urna: str
    sg_partido: str
    sg_federacao: str | None
    situacao: str


def parse_candidatos(raw_body: bytes, cargos: set[str]) -> list[Candidato]:
    out = []
    for d in rows(raw_body):
        cargo = d["DS_CARGO"].upper()
        if cargo not in cargos:
            continue
        fed = d.get("SG_FEDERACAO", "")
        out.append(
            Candidato(
                turno=int(d["NR_TURNO"]),
                cargo=cargo,
                uf="BR" if d["SG_UE"] == "BR" else d["SG_UF"],
                sq_candidato=d["SQ_CANDIDATO"],
                nr_candidato=_int(d, "NR_CANDIDATO"),
                nome_urna=d["NM_URNA_CANDIDATO"],
                sg_partido=d["SG_PARTIDO"],
                sg_federacao=None if fed in {"", "#NULO", "#NE"} else fed,
                situacao=d["DS_SIT_TOT_TURNO"],
            )
        )
    if not out:
        raise ValidationError("nenhuma candidatura dos cargos pedidos")
    return out


def check_votos_batem(apuracao: list[Apuracao], votos: list[Voto]) -> None:
    """Soma dos votos por candidato = votos válidos da apuração, em cada município e turno.

    Os dois números vêm de arquivos diferentes do TSE; se não baterem (por exemplo, um
    arquivo regenerado depois de uma retotalização e o outro não), nada é gravado.
    """
    validos = {(a.turno, a.cd_municipio_tse): a.validos for a in apuracao}
    soma: dict[tuple, int] = defaultdict(int)
    for v in votos:
        soma[(v.turno, v.cd_municipio_tse)] += v.votos
    if set(soma) != set(validos):
        faltam = sorted(set(validos) ^ set(soma))[:5]
        raise ValidationError(f"municípios diferentes entre apuração e votos: {faltam}")
    diff = [(k, soma[k], validos[k]) for k in validos if soma[k] != validos[k]]
    if diff:
        raise ValidationError(
            f"votos por candidato ≠ válidos da apuração em {len(diff)} casos: {diff[:3]}"
        )
