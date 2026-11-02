"""Leitura e validação de config/indicators.yaml e config/sources.yaml."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, model_validator

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


def sufixo_classificacao(classificacao: str | None) -> str:
    """Parte do id da série que vem das categorias: "2[6794]|58[2795]" → "_6794_2795"."""
    if not classificacao:
        return ""
    return "".join("_" + p.rstrip("]").split("[")[1] for p in classificacao.split("|"))


class FonteRef(_Strict):
    orgao: str
    tipo: Literal["ibge_agregados", "bcb_sgs"]
    tabela: int | None = None
    variavel: int | None = None
    codigo: int | None = None
    classificacao: str | None = None  # IBGE, uma categoria por classificação
    status: Literal["ok", "confirmar"]

    @model_validator(mode="after")
    def _codes(self) -> FonteRef:
        if self.tipo == "ibge_agregados" and (self.tabela is None or self.variavel is None):
            raise ValueError("ibge_agregados exige tabela e variavel")
        if self.tipo == "bcb_sgs" and self.codigo is None:
            raise ValueError("bcb_sgs exige codigo")
        return self

    @property
    def series_id(self) -> str:
        if self.tipo == "ibge_agregados":
            return f"ibge_agregados_{self.tabela}_{self.variavel}" + sufixo_classificacao(
                self.classificacao
            )
        return f"bcb_sgs_{self.codigo}"


Frequencia = Literal["diaria", "mensal", "trimestral_movel", "trimestral", "anual", "evento"]


class Tema(_Strict):
    slug: str
    titulo: str
    resumo: str
    ordem: int
    pagina: Literal["indicadores", "propria"] = "indicadores"


class Indicator(_Strict):
    slug: str
    titulo: str
    tema: str
    fonte_primaria: FonteRef
    fonte_reserva: FonteRef | None = None
    # Série monetária: a principal é a real e esta é a nominal (regra 3 do AGENTS.md).
    serie_nominal: FonteRef | None = None
    unidade: str
    tipo_serie: Literal["nivel", "taxa"]
    frequencia: Frequencia
    janela_padrao: Literal["12m", "5a", "10a", "tudo"]
    monetaria: bool
    casas_decimais: int = 2
    frase_template: str
    transformacao: str | None = None
    verificacao: str | None = None
    url_metodologia: str | None = None
    ordem: int | None = None

    @model_validator(mode="after")
    def _monetaria(self) -> Indicator:
        if self.monetaria and self.serie_nominal is None:
            raise ValueError(f"{self.slug}: série monetária exige serie_nominal (regra 3)")
        if not 0 <= self.casas_decimais <= 4:
            raise ValueError(f"{self.slug}: casas_decimais fora de 0..4")
        return self


class Source(_Strict):
    id: str
    nome: str
    orgao: str
    url_fonte: str | None = None
    url_documentacao: str | None = None
    url_metodologia: str | None = None
    licenca: str | None = None


class Series(_Strict):
    id: str
    source_id: str
    codigo_externo: str
    nome: str
    unidade: str
    frequencia: Frequencia
    tipo: Literal["nivel", "taxa"]
    monetaria: bool
    nota_metodologia: str | None = None
    # Como coletar (pipelines/jobs/series.py). O IPCA tem job próprio (jobs/ipca.py).
    coletor: Literal["series", "ipca"] = "series"
    classificacao: str | None = None  # IBGE, ex.: "11255[90707]"
    faixa: tuple[Decimal, Decimal] | None = None  # valores plausíveis; fora disso, recusa
    desde: date | None = None  # início do histórico buscado
    calendario: int | None = None  # produto no calendário do IBGE
    # Períodos que a fonte não publicou, com o motivo em nota_metodologia (ex.: PNAD
    # Contínua anual sem 2020 e 2021). Só estes buracos são aceitos na validação.
    lacunas: list[date] = []

    @model_validator(mode="after")
    def _coleta(self) -> Series:
        if self.coletor == "series" and self.faixa is None:
            raise ValueError(f"série {self.id}: informe a faixa plausível de valores")
        if self.faixa and self.faixa[0] >= self.faixa[1]:
            raise ValueError(f"série {self.id}: faixa invertida")
        return self


class Registry(BaseModel):
    sources: list[Source]
    series: list[Series]
    indicators: list[Indicator]
    temas: list[Tema]

    @model_validator(mode="after")
    def _references(self) -> Registry:
        source_ids = {s.id for s in self.sources}
        series_ids = {s.id for s in self.series}
        for s in self.series:
            if s.source_id not in source_ids:
                raise ValueError(f"série {s.id} cita fonte não registrada {s.source_id}")
            # Séries com classificação podem levar as categorias no id (obrigatório quando a
            # mesma tabela e variável aparecem com categorias diferentes).
            base = f"{s.source_id}_{s.codigo_externo.replace('/', '_')}"
            aceitos = {base, base + sufixo_classificacao(s.classificacao)}
            if s.id not in aceitos:
                raise ValueError(f"id da série {s.id} deveria ser um de {sorted(aceitos)}")
        tema_ids = {t.slug for t in self.temas}
        if len(tema_ids) != len(self.temas):
            raise ValueError("temas com slug repetido")
        slugs = [i.slug for i in self.indicators]
        if len(set(slugs)) != len(slugs):
            raise ValueError("indicadores com slug repetido")
        for ind in self.indicators:
            if ind.tema not in tema_ids:
                raise ValueError(f"{ind.slug}: tema '{ind.tema}' não está em config/temas.yaml")
            for ref in (ind.fonte_primaria, ind.fonte_reserva, ind.serie_nominal):
                if ref is None:
                    continue
                if ref.status != "ok":
                    raise ValueError(
                        f"{ind.slug}: fonte {ref.series_id} com status '{ref.status}'. "
                        "Teste contra a fonte e atualize docs/05 antes de usar."
                    )
                if ref.series_id not in series_ids:
                    raise ValueError(f"{ind.slug}: série {ref.series_id} não registrada")
            if not (CONFIG_DIR / "templates" / ind.frase_template).is_file():
                raise ValueError(f"{ind.slug}: template {ind.frase_template} não encontrado")
        return self


def load(config_dir: Path = CONFIG_DIR) -> Registry:
    sources = yaml.safe_load((config_dir / "sources.yaml").read_text(encoding="utf-8"))
    indicators = yaml.safe_load((config_dir / "indicators.yaml").read_text(encoding="utf-8"))
    temas = yaml.safe_load((config_dir / "temas.yaml").read_text(encoding="utf-8"))
    return Registry(
        sources=sources["sources"], series=sources["series"], indicators=indicators, temas=temas
    )


# ---- Eleições (config/eleicoes.yaml) ----


class TurnoEleicao(_Strict):
    turno: Literal[1, 2]
    data: date
    cd_eleicao_federal: int


class ArquivoTse(_Strict):
    zip: str
    membro: str
    pagina: str


class Eleicao(_Strict):
    ano: int
    fonte: str
    turnos: list[TurnoEleicao]
    arquivos: dict[Literal["apuracao", "votos_presidente", "candidatos"], ArquivoTse]
    vagas: dict[str, int]
    municipios_excecoes: dict[str, int]

    @model_validator(mode="after")
    def _check(self) -> Eleicao:
        if len(set(self.municipios_excecoes.values())) != len(self.municipios_excecoes):
            raise ValueError("municipios_excecoes aponta dois códigos TSE para o mesmo IBGE")
        if any(len(k) != 5 or not k.isdigit() for k in self.municipios_excecoes):
            raise ValueError("código TSE de município tem 5 dígitos, entre aspas")
        return self


def load_eleicao(config_dir: Path = CONFIG_DIR) -> Eleicao:
    data = yaml.safe_load((config_dir / "eleicoes.yaml").read_text(encoding="utf-8"))
    return Eleicao(**data)
