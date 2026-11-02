"""Valor de referência por série: um período antigo, lido da fonte, que não deve mudar.

Cada série de config/sources.yaml tem `referencia` com um período e o valor que a fonte
publicava para ele no dia da leitura. O teste `pytest -m network` (que roda antes de cada
coleta, .github/workflows/coleta.yml) busca esse período de novo, com o mesmo parser da
coleta, e exige o mesmo valor. Pega o que as outras travas não pegam: código que passou a
apontar para outra série com nome igual, parser que lê a coluna errada, unidade ou escala
trocada na fonte (ex.: % que vira fração) e revisão de período que a fonte dava por
fechado.

Séries que a fonte revisa inteiras a cada divulgação (ajuste sazonal, valores reais a
preços do período mais recente) não têm valor fixo: `referencia.sem_valor_fixo` diz por
quê, e a série é conferida pelas outras travas.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from pipelines.config import Series
from pipelines.sources import bcb_sgs, ibge_agregados


def valor_na_fonte(s: Series, periodo: date) -> Decimal | None:
    """Valor que a fonte publica hoje para `periodo`, pelo mesmo caminho da coleta."""
    if s.source_id == "bcb_sgs":
        fim = periodo + timedelta(days=7 if s.frequencia == "diaria" else 31)
        raw = bcb_sgs.fetch(int(s.codigo_externo), periodo, fim)
        obs = bcb_sgs.parse(raw.body, monthly=s.frequencia != "diaria")
    elif s.source_id == "ibge_agregados":
        tabela, var = (int(x) for x in s.codigo_externo.split("/"))
        p = ibge_agregados.date_to_period(periodo, s.frequencia)
        raw = ibge_agregados.fetch_variables(tabela, [var], p, s.classificacao)
        obs = ibge_agregados.parse_variables(
            raw.body, [var], classificacao=s.classificacao, tipo=s.frequencia
        )[var]
    else:
        raise ValueError(f"fonte sem leitura de referência: {s.source_id}")
    return next((o.value for o in obs if o.ref_date == periodo), None)
