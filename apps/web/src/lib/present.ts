// O que um cartão ou uma página mostra de um indicador, calculado uma vez a partir
// das linhas do banco. Nenhum valor novo: só seleção, janela e diferença.

import { formatRef, formatValue } from "./format";
import { JANELAS, lastOfMonth, sliceWindow, variation, variationText, type Obs } from "./indicator";
import type { IndicatorView } from "./data";

export type Presented = {
  latest: Obs;
  fmt: (n: number) => string;
  janelaRotulo: string;
  windowObs: Obs[];
  variacao: string | null;
  spark: number[];
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
    spark: pontos.map((o) => o.value),
    baseReal: series.monetaria ? `valor real, a preços de ${formatRef(latest.refDate, series.frequencia)}` : null,
  };
}
