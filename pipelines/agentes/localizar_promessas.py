"""Bloco 3 da aba Governos: trechos do plano de governo registrado no TSE com número
(docs/02, seção 10; decisão D27).

O modelo lê o plano inteiro, página a página, e devolve todo trecho em que a candidatura
promete ou se compromete com algo e que traz um número (quantidade, percentual, valor, ano
ou prazo em algarismos) como parte do que é prometido; número que é só referência (lei,
ano de um acordo) não conta. Diagnóstico e balanço do passado ficam de fora. Para cada trecho,
indica o indicador da mesma área numa lista fechada (os indicadores da aba), ou "nenhum".
O modelo copia o texto; nunca resume, reescreve nem completa.

Plano sem nenhuma promessa assim devolve lista vazia, e a página diz isso com o link do PDF.

O código confere, sem IA, e recusa a extração inteira se algum item falhar (falha fechada):
  * o trecho existe, literalmente, na página citada (ou na junção com a seguinte, quando o
    trecho atravessa a quebra), comparando sem espaços (o PDF quebra linhas no meio da
    frase e às vezes põe dois espaços entre palavras);
  * o trecho tem ao menos um algarismo e termina em fim de frase (não cortado no meio);
  * não há trecho repetido; o indicador está na lista.
"""

from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass
from pathlib import Path

from pdfminer.high_level import extract_text

from pipelines.agentes import nucleo

VERSAO_PROMPT = "localizar_promessas-v4"  # v3: texto do pdfminer; v4: frase inteira
NENHUM = "nenhum"
MAX_TRECHO = 600
PAGINAS_POR_BLOCO = 8  # o plano é lido em blocos, para a saída caber no limite de tokens

SISTEMA = """Você localiza promessas com número em planos de governo registrados no TSE, para o oBrasa,
um site de dados públicos que não toma lado.

Regras:
- Leia o texto inteiro. Liste TODO trecho em que a candidatura promete, propõe ou se compromete
  com algo E em que um algarismo faz parte do que é prometido: uma meta, quantidade, percentual,
  valor ou prazo (por exemplo "criar 2 milhões de vagas", "zerar o déficit em 2 anos",
  "até 2030").
- Fica de fora: número que é só referência (lei, artigo, Constituição de 1988, ano de um
  acordo ou conferência, nome de programa), diagnóstico, dado do passado, balanço de governo
  anterior, título, sumário, número de página e número de item de lista.
- Se o texto não tiver nenhuma promessa assim, devolva a lista vazia.
- Copie o trecho EXATAMENTE como está no texto, letra por letra, com os mesmos espaços e erros
  de digitação. Não resuma, não corrija, não complete. Use a menor frase ou frases completas
  que contenham a promessa e o número (até 600 caracteres), terminando no ponto final.
- `pagina` é o número que aparece em [página N] antes do texto onde o trecho começa.
- `indicador`: o indicador da lista que mede a mesma área da promessa, ou "nenhum" se nenhum
  medir diretamente. Não force: promessa de saúde, educação ou obras é "nenhum".
- Não escolha quais promessas mostrar: o critério é o número, para todas as áreas e na ordem
  em que aparecem no plano.
"""


@dataclass(frozen=True)
class Trecho:
    pagina: int
    trecho: str
    indicador: str | None


def paginas_do_pdf(pdf: bytes) -> list[str]:
    """Texto de cada página. O pdfminer separa as páginas com \\f e, ao contrário do pypdf,
    não parte palavras com espaços soltos ("est ão"), o que deixaria a citação feia na tela."""
    paginas = extract_text(io.BytesIO(pdf)).split("\f")
    if paginas and not paginas[-1].strip():
        paginas.pop()
    return paginas


def _sem_espaco(t: str) -> str:
    return re.sub(r"\s+", "", t)


def entrada(paginas: list[str], titulo: str, indicadores: dict[str, str], primeira: int = 1) -> str:
    lista = "\n".join(f"- {k}: {v}" for k, v in indicadores.items())
    corpo = "\n\n".join(f"[página {i}]\n{t}" for i, t in enumerate(paginas, start=primeira))
    return (
        f"Plano: {titulo}\n\nIndicadores da lista fechada:\n{lista}\n- {NENHUM}: nenhum dos acima\n\n"
        f"Texto do plano, como extraído do PDF:\n\n{corpo}"
    )


def schema(indicadores: dict[str, str]) -> dict:
    return {
        "type": "object",
        "properties": {
            "trechos": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "pagina": {"type": "integer"},
                        "trecho": {"type": "string"},
                        "indicador": {"type": "string", "enum": [*indicadores, NENHUM]},
                    },
                    "required": ["pagina", "trecho", "indicador"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["trechos"],
        "additionalProperties": False,
    }


def confere(saida: dict, paginas: list[str], indicadores: dict[str, str]) -> list[str]:
    """Verificações do código sobre a saída do modelo. Lista vazia: aceita."""
    problemas: list[str] = []
    limpas = [_sem_espaco(p) for p in paginas]
    vistos: set[str] = set()
    trechos = saida.get("trechos", [])
    for t in trechos:
        p, texto = t["pagina"], t["trecho"]
        alvo = _sem_espaco(texto)
        if not 1 <= p <= len(paginas):
            problemas.append(f"página {p} fora do plano ({len(paginas)} páginas)")
            continue
        junto = limpas[p - 1] + (limpas[p] if p < len(paginas) else "")
        if alvo not in junto:
            problemas.append(f"trecho não está na página {p}: {texto[:120]!r}")
        if not re.search(r"\d", texto):
            problemas.append(f"trecho sem algarismo (página {p}): {texto[:120]!r}")
        if not re.search(r"[.!?;:)\]\"”]\s*$", texto):
            problemas.append(f"trecho cortado no meio da frase (página {p}): ...{texto[-60:]!r}")
        if len(texto) > MAX_TRECHO:
            problemas.append(f"trecho com mais de {MAX_TRECHO} caracteres (página {p})")
        if alvo in vistos:
            problemas.append(f"trecho repetido (página {p}): {texto[:80]!r}")
        vistos.add(alvo)
        if t["indicador"] not in indicadores and t["indicador"] != NENHUM:
            problemas.append(f"indicador fora da lista: {t['indicador']!r}")
    return problemas


def confere_bloco(
    saida: dict, bloco: list[str], primeira: int, indicadores: dict[str, str]
) -> list[str]:
    """Como `confere`, para um bloco de páginas: aceita bloco sem promessa; a página tem de
    estar no bloco (a seguinte vale só para trecho que atravessa a quebra)."""
    trechos = saida.get("trechos", [])
    if not trechos:
        return []
    fora = [t["pagina"] for t in trechos if not primeira <= t["pagina"] < primeira + len(bloco)]
    if fora:
        return [f"página {p} fora do bloco {primeira}–{primeira + len(bloco) - 1}" for p in fora]
    deslocado = {"trechos": [{**t, "pagina": t["pagina"] - primeira + 1} for t in trechos]}
    return confere(deslocado, bloco, indicadores)


def hash_de(pdf: bytes, indicadores: dict[str, str]) -> str:
    h = hashlib.sha256(pdf)
    h.update(f"|{VERSAO_PROMPT}|{nucleo.MODELO}|{sorted(indicadores.items())}".encode())
    return h.hexdigest()


def localiza(
    pdf: bytes,
    titulo: str,
    indicadores: dict[str, str],
    client=None,
    pasta_registro: Path = Path("data/agentes/registros"),
) -> tuple[list[Trecho] | None, nucleo.Resultado]:
    """Trechos conferidos, ou None se algum bloco for recusado (pelo agente ou pelo código)."""
    paginas = paginas_do_pdf(pdf)
    todos: list[dict] = []
    total = nucleo.Resultado(aceito=False, saida=None)
    for inicio in range(0, len(paginas), PAGINAS_POR_BLOCO):
        bloco = paginas[inicio : inicio + PAGINAS_POR_BLOCO]
        primeira = inicio + 1
        tarefa = nucleo.Tarefa(
            agente="localizar_promessas",
            versao_prompt=VERSAO_PROMPT,
            sistema=SISTEMA,
            entrada=entrada(bloco, titulo, indicadores, primeira),
            schema=schema(indicadores),
            campos_texto=lambda saida: [],  # só citações; não há texto livre
            extra=lambda saida, b=bloco, p0=primeira: confere_bloco(saida, b, p0, indicadores),
            esforco="high",
            max_turnos=3,
        )
        r = nucleo.executa(tarefa, [], [], client=client, pasta_registro=pasta_registro)
        total.turnos += r.turnos
        for k, v in r.uso.items():
            total.uso[k] = total.uso.get(k, 0) + v
        if not r.aceito or r.saida is None:
            total.problemas = [
                f"páginas {primeira}–{primeira + len(bloco) - 1}: {p}" for p in r.problemas
            ]
            return None, total
        todos += r.saida["trechos"]
    if problemas := confere({"trechos": todos}, paginas, indicadores):
        total.problemas = problemas
        return None, total
    total.aceito, total.saida = True, {"trechos": todos}
    trechos = [
        Trecho(t["pagina"], t["trecho"], None if t["indicador"] == NENHUM else t["indicador"])
        for t in todos
    ]
    return trechos, total
