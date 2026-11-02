"""Núcleo dos agentes: loop com ferramentas, limites, registro e verificações da saída.

Cada agente (investigar, revisar, auditar_textos) define o prompt, o schema da saída e
quais campos são texto livre. O núcleo:

  1. roda o loop de ferramentas com limite de turnos (sem ferramenta de escrita: ver
     ferramentas.py);
  2. exige a saída no schema JSON (structured outputs);
  3. aplica as verificações de docs/06, "Regras de uso de IA":
       * todo número e data com lastro numa saída de ferramenta ou na entrada (numeros.py);
       * toda citação marcada como evidência existe, literalmente, numa saída de ferramenta;
       * nenhum termo proibido de config/forbidden_terms.yaml;
     com uma chance de correção. Se continuar falhando, a saída é recusada inteira;
  4. registra entrada, cada chamada, cada ferramenta, saída, modelo e versão do prompt em
     JSONL (data/agentes/registros/), para auditoria.

Recusa de segurança do modelo, limite de turnos ou erro da API viram `Resultado` com
`aceito=False`: o agente falhar nunca interrompe a coleta (docs/06).
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import anthropic

from pipelines.agentes import numeros
from pipelines.agentes.ferramentas import FerramentaRecusada
from scripts.check_terms import ROOT as RAIZ_TERMOS
from scripts.check_terms import check_text, load_rules

log = logging.getLogger(__name__)

MODELO = "claude-opus-5-5"
BETA_FALLBACK = "server-side-fallback-2026-07-01"


@dataclass(frozen=True)
class Ferramenta:
    nome: str
    descricao: str
    parametros: dict  # propriedades do JSON Schema
    obrigatorios: tuple[str, ...]
    executa: Callable[..., str]

    def definicao(self) -> dict:
        return {
            "name": self.nome,
            "description": self.descricao,
            "strict": True,
            "input_schema": {
                "type": "object",
                "properties": self.parametros,
                "required": list(self.obrigatorios),
                "additionalProperties": False,
            },
        }


@dataclass(frozen=True)
class Tarefa:
    agente: str  # nome curto, vai no registro
    versao_prompt: str
    sistema: str
    entrada: str  # mensagem inicial; também é lastro para números
    schema: dict  # JSON Schema da saída
    campos_texto: Callable[[dict], list[str]]  # textos livres da saída a verificar
    citacoes: Callable[[dict], list[str]] = lambda saida: []  # devem existir literalmente
    extra: Callable[[dict], list[str]] = lambda saida: []  # verificações próprias do agente
    esforco: str = "high"
    max_turnos: int = 25


@dataclass
class Resultado:
    aceito: bool
    saida: dict | None
    problemas: list[str] = field(default_factory=list)
    turnos: int = 0
    uso: dict = field(default_factory=dict)
    registro: Path | None = None


def _normaliza(texto: str) -> str:
    return re.sub(r"\s+", " ", texto).strip()


def verifica_saida(
    tarefa: Tarefa, saida: dict, saidas_ferramentas: list[str], regras_termos: dict
) -> list[str]:
    """As três verificações de docs/06. Lista vazia: saída aceita."""
    problemas = []
    lastro = numeros.Lastro.de([tarefa.entrada, *saidas_ferramentas])
    textos = tarefa.campos_texto(saida)
    for texto in textos:
        for p in numeros.verifica(texto, lastro):
            problemas.append(f"número sem lastro: {p.trecho!r} ({p.motivo})")
    corpus = [_normaliza(s) for s in saidas_ferramentas]
    for citacao in tarefa.citacoes(saida):
        if not any(_normaliza(citacao) in s for s in corpus):
            problemas.append(f"citação que não aparece em nenhuma ferramenta: {citacao[:120]!r}")
    for hit in check_text("\n".join(textos), "agente.md", regras_termos):
        problemas.append(f"termo proibido {hit.match!r}: use {hit.usar}")
    return problemas + tarefa.extra(saida)


class _Registro:
    def __init__(self, pasta: Path, tarefa: Tarefa):
        pasta.mkdir(parents=True, exist_ok=True)
        carimbo = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        self.caminho = pasta / f"{carimbo}-{tarefa.agente}.jsonl"
        self.escreve(
            "inicio",
            agente=tarefa.agente,
            modelo=MODELO,
            versao_prompt=tarefa.versao_prompt,
            sistema=tarefa.sistema,
            entrada=tarefa.entrada,
        )

    def escreve(self, evento: str, **dados) -> None:
        linha = {"evento": evento, "em": datetime.now(UTC).isoformat(), **dados}
        with self.caminho.open("a", encoding="utf-8") as f:
            f.write(json.dumps(linha, ensure_ascii=False, default=str) + "\n")


def _dump(bloco) -> dict:
    return bloco.model_dump() if hasattr(bloco, "model_dump") else dict(vars(bloco))


def _soma_uso(total: dict, uso) -> None:
    for k in (
        "input_tokens",
        "output_tokens",
        "cache_read_input_tokens",
        "cache_creation_input_tokens",
    ):
        total[k] = total.get(k, 0) + (getattr(uso, k, 0) or 0)


def executa(
    tarefa: Tarefa,
    ferramentas: list[Ferramenta],
    saidas_ferramentas: list[str],
    client=None,
    pasta_registro: Path = Path("data/agentes/registros"),
) -> Resultado:
    """Roda o agente até a saída final verificada, ou até recusar."""
    client = client or anthropic.Anthropic()
    regras_termos = load_rules(RAIZ_TERMOS / "config" / "forbidden_terms.yaml")
    por_nome = {f.nome: f for f in ferramentas}
    registro = _Registro(pasta_registro, tarefa)
    mensagens: list[dict] = [{"role": "user", "content": tarefa.entrada}]
    resultado = Resultado(aceito=False, saida=None, registro=registro.caminho)
    correcao_pedida = False

    while resultado.turnos < tarefa.max_turnos:
        resultado.turnos += 1
        try:
            resp = client.beta.messages.create(
                model=MODELO,
                max_tokens=16000,
                system=tarefa.sistema,
                tools=[f.definicao() for f in ferramentas],
                messages=mensagens,
                output_config={
                    "effort": tarefa.esforco,
                    "format": {"type": "json_schema", "schema": tarefa.schema},
                },
                cache_control={"type": "ephemeral"},
                betas=[BETA_FALLBACK],
                fallbacks="default",
            )
        except anthropic.APIError as exc:
            resultado.problemas.append(f"erro da API: {type(exc).__name__}: {exc}")
            registro.escreve("erro_api", erro=str(exc))
            return resultado
        _soma_uso(resultado.uso, resp.usage)
        registro.escreve(
            "resposta",
            turno=resultado.turnos,
            modelo=getattr(resp, "model", None),
            stop_reason=resp.stop_reason,
            conteudo=[_dump(b) for b in resp.content],
            uso=_dump(resp.usage) if resp.usage else None,
        )
        mensagens.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason == "refusal":
            resultado.problemas.append("o modelo recusou a tarefa (stop_reason refusal)")
            return resultado
        if resp.stop_reason == "max_tokens":
            resultado.problemas.append("resposta cortada por max_tokens")
            return resultado

        chamadas = [b for b in resp.content if b.type == "tool_use"]
        if chamadas:
            retornos = []
            for c in chamadas:
                retornos.append(_roda_ferramenta(por_nome, c, registro))
            mensagens.append({"role": "user", "content": retornos})
            continue

        texto = "".join(b.text for b in resp.content if b.type == "text")
        try:
            saida = json.loads(texto)
        except ValueError:
            resultado.problemas.append("saída final fora do formato JSON pedido")
            return resultado
        problemas = verifica_saida(tarefa, saida, saidas_ferramentas, regras_termos)
        registro.escreve("verificacao", problemas=problemas, correcao=correcao_pedida)
        if not problemas:
            resultado.aceito, resultado.saida = True, saida
            registro.escreve("fim", aceito=True, uso=resultado.uso, turnos=resultado.turnos)
            return resultado
        if correcao_pedida:
            resultado.saida, resultado.problemas = saida, problemas
            registro.escreve("fim", aceito=False, problemas=problemas, uso=resultado.uso)
            return resultado
        correcao_pedida = True
        mensagens.append(
            {
                "role": "user",
                "content": "A saída foi recusada pelas verificações automáticas:\n"
                + "\n".join(f"- {p}" for p in problemas)
                + "\n\nCorrija: copie números, datas e citações exatamente como aparecem nas "
                "saídas das ferramentas, ou retire-os. Não arredonde. Se precisar, consulte "
                "de novo. Responda com a saída completa no mesmo formato.",
            }
        )

    resultado.problemas.append(f"limite de {tarefa.max_turnos} turnos sem saída final")
    registro.escreve("fim", aceito=False, problemas=resultado.problemas, uso=resultado.uso)
    return resultado


def _roda_ferramenta(por_nome: dict[str, Ferramenta], chamada, registro: _Registro) -> dict:
    f = por_nome.get(chamada.name)
    try:
        if f is None:
            raise FerramentaRecusada(f"ferramenta inexistente: {chamada.name}")
        conteudo, erro = f.executa(**chamada.input), False
    except FerramentaRecusada as exc:
        conteudo, erro = f"Recusado: {exc}", True
    except Exception as exc:  # falha de rede, fonte fora do ar: o agente precisa saber
        conteudo, erro = f"Falhou: {type(exc).__name__}: {exc}", True
    registro.escreve(
        "ferramenta", nome=chamada.name, entrada=chamada.input, erro=erro, saida=conteudo
    )
    return {"type": "tool_result", "tool_use_id": chamada.id, "content": conteudo, "is_error": erro}
