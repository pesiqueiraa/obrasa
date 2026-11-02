// O que um cartão ou uma página mostra de um indicador, calculado uma vez a partir
// das linhas do banco. Nenhum valor novo: só seleção, janela e diferença.

import { addMonths, formatRef, formatValue } from "./format";
import { JANELAS, PASSO_MESES, lastOfMonth, sliceWindow, variation, variationText, type Obs } from "./indicator";
import type { IndicatorView } from "./data";

export type Presented = {
  latest: Obs;
  fmt: (n: number) => string;
  janelaRotulo: string;
  windowObs: Obs[];
  variacao: string | null;
  /** null = período que a fonte não publicou; a minilinha se interrompe ali. */
  spark: (number | null)[];
  /** Rótulo de cada ponto da minilinha ("set/2025: 5,17%"), para a leitura ao passar o dedo. */
  sparkRotulos: (string | null)[];
  /** Regra 3: em série monetária, de que preços é o valor real. */
  baseReal: string | null;
};

export function present(view: IndicatorView): Presented {
  const { indicator, exibida } = view;
  const { series, obs } = exibida;
  const latest = obs[obs.length - 1];
  const janela = JANELAS.find((j) => j.id === indicator.janela_padrao) ?? JANELAS[1];
  const windowObs = sliceWindow(obs, janela.id);
  const fmt = (n: number) => formatValue(n, series.unidade, indicator.casas_decimais);
  const v = variation(windowObs, series.tipo);
  const pontos = series.frequencia === "diaria" ? lastOfMonth(windowObs) : windowObs;
  return {
    latest,
    fmt,
    janelaRotulo: janela.rotulo,
    windowObs,
    variacao: v ? variationText(v, janela.rotulo, fmt, series.frequencia) : null,
    spark: comLacunas(pontos, PASSO_MESES[series.frequencia]).map((o) => o?.value ?? null),
    sparkRotulos: comLacunas(pontos, PASSO_MESES[series.frequencia]).map((o) =>
      o ? `${formatRef(o.refDate, series.frequencia)}: ${fmt(o.value)}` : null,
    ),
    baseReal: series.monetaria ? `valor real, a preços de ${formatRef(latest.refDate, series.frequencia)}` : null,
  };
}

function comLacunas(pontos: Obs[], passo: number | undefined): (Obs | null)[] {
  const out: (Obs | null)[] = [];
  pontos.forEach((o, i) => {
    if (passo && i > 0) {
      for (let r = addMonths(pontos[i - 1].refDate, passo); r < o.refDate; r = addMonths(r, passo)) out.push(null);
    }
    out.push(o);
  });
  return out;
}
