"""Segunda fonte: série do IBGE conferida contra a cópia que o Banco Central publica no SGS.

O mesmo número chega por dois órgãos e dois sistemas diferentes. Se discordarem, a
coleta da tabela do IBGE para sem gravar. Pares e regras ficam em `conferir_com`
(config/sources.yaml); a comparação com o histórico completo está em docs/05.

Regras:
  * igual: o valor tem que ser idêntico (desocupação, 6381/4099 × SGS 24369);
  * variacao_trimestral: taxa contra o trimestre anterior, calculada do índice do SGS;
  * acumulado_4_trimestres: taxa dos últimos 4 trimestres contra os 4 anteriores,
    calculada do índice do SGS.

Nas regras calculadas, a tolerância vem do arredondamento: o IBGE publica a taxa com 1
casa (erro de até 0,05 p.p.) e o índice do SGS vem com 2 casas (erro de até ~0,005 p.p.
na taxa). Por isso 0,06 p.p., e não um valor ajustado a olho.

Só os períodos que existem nos dois lados são comparados: a cópia do BC pode sair dias
depois do IBGE. Um período ainda sem cópia passa sem conferência e é conferido na coleta
seguinte, quando a cópia sair.
"""

from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

from pipelines.models import Observation, ValidationError

_CEM = Decimal(100)


def derivada(regra: str, copia: dict[date, Decimal]) -> dict[date, Decimal]:
    if regra == "igual":
        return dict(copia)
    ks = sorted(copia)
    if regra == "variacao_trimestral":
        return {b: (copia[b] / copia[a] - 1) * _CEM for a, b in itertools.pairwise(ks)}
    if regra == "acumulado_4_trimestres":
        out = {}
        for i in range(7, len(ks)):
            atual = sum(copia[k] for k in ks[i - 3 : i + 1])
            anterior = sum(copia[k] for k in ks[i - 7 : i - 3])
            out[ks[i]] = (atual / anterior - 1) * _CEM
        return out
    raise ValueError(f"regra desconhecida: {regra}")


def confere(
    serie: str,
    copia_id: str,
    regra: str,
    tolerancia: Decimal,
    desde: date | None,
    novas: list[Observation],
    copia: dict[date, Decimal],
) -> int:
    """Quantos períodos foram comparados. Falha com ValidationError se discordarem."""
    if not copia:
        raise ValidationError(f"{serie}: cópia {copia_id} vazia no banco; colete o SGS antes")
    ref = derivada(regra, copia)
    comuns = [o for o in novas if o.ref_date in ref and (desde is None or o.ref_date >= desde)]
    if not comuns:
        raise ValidationError(f"{serie}: nenhum período em comum com {copia_id}")
    diverge = [o for o in comuns if abs(o.value - ref[o.ref_date]) > tolerancia]
    if diverge:
        exemplos = "; ".join(
            f"{o.ref_date}: IBGE {o.value}, {copia_id} {ref[o.ref_date]:.4f}" for o in diverge[-3:]
        )
        raise ValidationError(
            f"{serie}: discorda de {copia_id} em {len(diverge)} de {len(comuns)} períodos "
            f"(tolerância {tolerancia}): {exemplos}"
        )
    return len(comuns)
