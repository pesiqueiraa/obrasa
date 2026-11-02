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


class NaFonte(_Strict):
    """Descrição da série como a fonte declara hoje (pipelines/metadados.py)."""

    nome: str
    unidade: str
    periodicidade: str
    categorias: list[str] = []


FONTES_COM_DESCRICAO = {"bcb_sgs", "ibge_agregados"}


class Referencia(_Strict):
    """Período antigo e o valor que a fonte publicava para ele (pipelines/referencia.py)."""

    periodo: date | None = None
    valor: Decimal | None = None
    lido_em: date | None = None  # dia em que o valor foi lido da fonte
    sem_valor_fixo: str | None = None  # motivo, quando a fonte revisa a série inteira

    @model_validator(mode="after")
    def _completa(self) -> Referencia:
        fixo = (self.periodo, self.valor, self.lido_em)
        if self.sem_valor_fixo:
            if any(x is not None for x in fixo):
                raise ValueError("referencia: use periodo/valor/lido_em ou sem_valor_fixo")
        elif any(x is None for x in fixo):
            raise ValueError("referencia: informe periodo, valor e lido_em")
        return self


class ConferirCom(_Strict):
    """Segunda fonte da série (pipelines/segunda_fonte.py)."""

    serie: str
    regra: Literal["igual", "variacao_trimestral", "acumulado_4_trimestres"]
    tolerancia: Decimal = Decimal(0)
    anos: int | None = None  # só os últimos N anos (diferença antiga documentada em docs/05)


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
    na_fonte: NaFonte | None = None  # obrigatório no BCB e no IBGE
    referencia: Referencia | None = None  # obrigatório: valor conhecido da fonte
    conferir_com: ConferirCom | None = None  # segunda fonte
    # Prazo de divulgação quando a fonte não tem calendário: [meses, dias] contados do 1º
    # dia do último período. Sem isso vale o padrão da frequência (pipelines/jobs/atrasos.py).
    prazo: tuple[int, int] | None = None
    # Períodos que a fonte não publicou, com o motivo em nota_metodologia (ex.: PNAD
    # Contínua anual sem 2020 e 2021). Só estes buracos são aceitos na validação.
    lacunas: list[date] = []

    @model_validator(mode="after")
    def _coleta(self) -> Series:
        if self.coletor == "series" and self.faixa is None:
            raise ValueError(f"série {self.id}: informe a faixa plausível de valores")
        if self.faixa and self.faixa[0] >= self.faixa[1]:
            raise ValueError(f"série {self.id}: faixa invertida")
        if self.source_id in FONTES_COM_DESCRICAO and self.na_fonte is None:
            raise ValueError(f"série {self.id}: informe `na_fonte` (descrição na fonte)")
        if self.referencia is None:
            raise ValueError(f"série {self.id}: informe `referencia` (valor conhecido da fonte)")
        return self


class Liberacao(_Strict):
    """Valor conferido por um humano que passa da checagem de salto (config/aprovacoes.yaml)."""

    serie: str
    periodo: date
    valor: Decimal
    conferido_por: str
    conferido_em: date
    evidencia: str
    motivo: str


def _coerente(ind: Indicator, s: Series, nominal: bool) -> None:
    """O indicador descreve a série que ele mostra: mesma unidade, frequência e tipo.

    Uma divergência aqui faz a tela rotular o número com unidade ou período errados."""
    campos = [("unidade", ind.unidade, s.unidade), ("frequencia", ind.frequencia, s.frequencia)]
    campos.append(("tipo", ind.tipo_serie, s.tipo))
    if not nominal:
        campos.append(("monetaria", ind.monetaria, s.monetaria))
    for nome, a, b in campos:
        if a != b:
            raise ValueError(
                f"{ind.slug}: {nome} do indicador ({a!r}) difere da série {s.id} ({b!r})"
            )


class Registry(BaseModel):
    sources: list[Source]
    series: list[Series]
    indicators: list[Indicator]
    temas: list[Tema]
    liberacoes: list[Liberacao] = []

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
        por_id = {s.id: s for s in self.series}
        for s in self.series:
            if s.conferir_com:
                outra = por_id.get(s.conferir_com.serie)
                if outra is None:
                    raise ValueError(f"{s.id}: conferir_com cita série não registrada")
                if outra.source_id == s.source_id:
                    raise ValueError(f"{s.id}: a segunda fonte precisa ser de outro órgão")
        for lib in self.liberacoes:
            if lib.serie not in series_ids and not lib.serie.startswith("mapa/"):
                raise ValueError(f"liberação para série não registrada: {lib.serie}")
            if not lib.evidencia.startswith("https://"):
                raise ValueError(f"liberação de {lib.serie} {lib.periodo} sem link de evidência")
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
                _coerente(ind, por_id[ref.series_id], nominal=ref is ind.serie_nominal)
            if ind.monetaria and ind.serie_nominal is None:
                raise ValueError(
                    f"{ind.slug}: indicador monetário sem `serie_nominal` (regra 3: nominal e real)"
                )
            if not (CONFIG_DIR / "templates" / ind.frase_template).is_file():
                raise ValueError(f"{ind.slug}: template {ind.frase_template} não encontrado")
        return self


def load(config_dir: Path = CONFIG_DIR) -> Registry:
    sources = yaml.safe_load((config_dir / "sources.yaml").read_text(encoding="utf-8"))
    indicators = yaml.safe_load((config_dir / "indicators.yaml").read_text(encoding="utf-8"))
    temas = yaml.safe_load((config_dir / "temas.yaml").read_text(encoding="utf-8"))
    aprovacoes = yaml.safe_load((config_dir / "aprovacoes.yaml").read_text(encoding="utf-8"))
    return Registry(
        sources=sources["sources"],
        series=sources["series"],
        indicators=indicators,
        temas=temas,
        liberacoes=aprovacoes["liberacoes"] or [],
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


# --- Notícias (config/noticias.yaml) ---


class Veiculo(_Strict):
    id: str
    nome: str
    dominio: str  # o link de cada matéria tem de ser deste domínio (ou subdomínio)
    feeds: list[str]


class RegraTema(_Strict):
    termos: list[str]
    excluir: list[str] = []


class Noticias(_Strict):
    trecho_max: int
    janela_dias: int
    excluir_url: list[str] = []  # trechos de endereço (seções de opinião)
    excluir_titulo: list[str] = []  # termos no título (notícias de outros países)
    veiculos: list[Veiculo]
    temas: dict[str, RegraTema]

    @model_validator(mode="after")
    def _check(self) -> Noticias:
        ids = [v.id for v in self.veiculos]
        if len(set(ids)) != len(ids):
            raise ValueError("veículos com id repetido")
        if ids != sorted(ids):
            raise ValueError("veículos fora da ordem alfabética (config/noticias.yaml)")
        if not 0 < self.trecho_max <= 300:
            raise ValueError("trecho_max acima de 300 caracteres não é trecho curto (regra 7)")
        if any(not f.startswith("https://") for v in self.veiculos for f in v.feeds):
            raise ValueError("feed sem https")
        return self


def load_noticias(config_dir: Path = CONFIG_DIR, temas: list[Tema] | None = None) -> Noticias:
    data = yaml.safe_load((config_dir / "noticias.yaml").read_text(encoding="utf-8"))
    n = Noticias(**data)
    slugs = {t.slug for t in (temas if temas is not None else load(config_dir).temas)}
    if desconhecidos := set(n.temas) - slugs:
        raise ValueError(f"noticias.yaml cita temas fora de temas.yaml: {sorted(desconhecidos)}")
    return n


# ---- Agenda: reuniões do Copom (config/copom.yaml) ----


class ReuniaoCopom(_Strict):
    numero: int
    inicio: date
    decisao: date

    @model_validator(mode="after")
    def _check(self) -> ReuniaoCopom:
        if not 0 <= (self.decisao - self.inicio).days <= 2:
            raise ValueError(f"reunião {self.numero}: decisão fora dos dias da reunião")
        return self


class Copom(_Strict):
    fonte: str
    reunioes: list[ReuniaoCopom]

    @model_validator(mode="after")
    def _check(self) -> Copom:
        numeros = [r.numero for r in self.reunioes]
        if numeros != sorted(set(numeros)):
            raise ValueError("reuniões do Copom repetidas ou fora de ordem")
        datas = [r.inicio for r in self.reunioes]
        if datas != sorted(datas):
            raise ValueError("reuniões do Copom fora da ordem das datas")
        return self


def load_copom(config_dir: Path = CONFIG_DIR) -> Copom:
    return Copom(**yaml.safe_load((config_dir / "copom.yaml").read_text(encoding="utf-8")))


# ---- Mapas por estado (config/regional.yaml) ----


class MapaUf(_Strict):
    id: str
    tema: str
    titulo: str
    indicador: str
    tabela: int
    variavel: int
    classificacao: str | None = None
    frequencia: Literal["mensal", "trimestral_movel", "trimestral", "anual"]
    periodos: str
    unidade: str
    casas: int
    faixa: tuple[Decimal, Decimal]
    prazo: tuple[int, int] | None = None  # como em Series.prazo
    na_fonte: NaFonte  # como em Series.na_fonte


class Regional(_Strict):
    mapas: list[MapaUf]

    @model_validator(mode="after")
    def _check(self) -> Regional:
        ids = [m.id for m in self.mapas]
        if len(set(ids)) != len(ids):
            raise ValueError("mapas com id repetido (config/regional.yaml)")
        return self


def load_regional(config_dir: Path = CONFIG_DIR, registry: Registry | None = None) -> Regional:
    r = Regional(**yaml.safe_load((config_dir / "regional.yaml").read_text(encoding="utf-8")))
    reg = registry or load(config_dir)
    slugs = {i.slug for i in reg.indicators}
    temas = {t.slug for t in reg.temas}
    for m in r.mapas:
        if m.indicador not in slugs or m.tema not in temas:
            raise ValueError(f"mapa {m.id}: indicador ou tema fora do registro")
    return r
