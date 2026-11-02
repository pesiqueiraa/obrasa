"""Leitura e validação de config/indicators.yaml e config/sources.yaml."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, model_validator

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FonteRef(_Strict):
    orgao: str
    tipo: Literal["ibge_agregados", "bcb_sgs"]
    tabela: int | None = None
    variavel: int | None = None
    codigo: int | None = None
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
            return f"ibge_agregados_{self.tabela}_{self.variavel}"
        return f"bcb_sgs_{self.codigo}"


class Indicator(_Strict):
    slug: str
    titulo: str
    fonte_primaria: FonteRef
    fonte_reserva: FonteRef | None = None
    unidade: str
    tipo_serie: Literal["nivel", "taxa"]
    frequencia: Literal["diaria", "mensal", "trimestral", "anual", "evento"]
    janela_padrao: Literal["12m", "5a", "10a", "tudo"]
    monetaria: bool
    frase_template: str
    transformacao: str | None = None
    verificacao: str | None = None
    url_metodologia: str | None = None
    ordem: int | None = None


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
    frequencia: Literal["diaria", "mensal", "trimestral", "anual", "evento"]
    tipo: Literal["nivel", "taxa"]
    monetaria: bool
    nota_metodologia: str | None = None


class Registry(BaseModel):
    sources: list[Source]
    series: list[Series]
    indicators: list[Indicator]

    @model_validator(mode="after")
    def _references(self) -> Registry:
        source_ids = {s.id for s in self.sources}
        series_ids = {s.id for s in self.series}
        for s in self.series:
            if s.source_id not in source_ids:
                raise ValueError(f"série {s.id} cita fonte não registrada {s.source_id}")
            expected = f"{s.source_id}_{s.codigo_externo.replace('/', '_')}"
            if s.id != expected:
                raise ValueError(f"id da série {s.id} deveria ser {expected}")
        for ind in self.indicators:
            for ref in (ind.fonte_primaria, ind.fonte_reserva):
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
    return Registry(sources=sources["sources"], series=sources["series"], indicators=indicators)
