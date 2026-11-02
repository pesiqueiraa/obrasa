"use client";

// Gráfico de linha com @carbon/charts-react (DESIGN.md, "Implementação").
// Uma série: chart-1 (#23408E). A linha pode não começar do zero, mas o eixo fica
// sempre visível e rotulado. Sem animação do Carbon.

import { LineChart } from "@carbon/charts-react";
import { ScaleTypes, type LineChartOptions } from "@carbon/charts";
import "@carbon/charts-react/styles.css";
import { addMonths, formatNumber, formatRef, formatValue, parseDay, type FrequenciaRef } from "@/lib/format";

// Distância entre períodos; um período ausente na fonte vira ponto vazio, e a linha
// é interrompida ali em vez de ligar os vizinhos (ex.: PNAD anual sem 2020 e 2021).
const PASSO: Partial<Record<FrequenciaRef, number>> = { mensal: 1, trimestral_movel: 1, trimestral: 3, anual: 12 };

const CHART_1 = "#23408E";

function toDate(ref: string): Date {
  const [y, m, d] = parseDay(ref);
  return new Date(y, m - 1, d);
}

function toRef(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function LineChartClient({
  obs,
  serieRotulo,
  unidade,
  casas,
  eixo,
  frequencia,
  pontos,
}: {
  obs: { refDate: string; value: number }[];
  serieRotulo: string;
  unidade: string;
  casas: number;
  eixo: string;
  frequencia: FrequenciaRef;
  pontos: boolean;
}) {
  const passo = PASSO[frequencia];
  const data: { group: string; date: Date; value: number | null }[] = [];
  obs.forEach((o, i) => {
    if (passo && i > 0) {
      for (let r = addMonths(obs[i - 1].refDate, passo); r < o.refDate; r = addMonths(r, passo)) {
        data.push({ group: serieRotulo, date: toDate(r), value: null });
      }
    }
    data.push({ group: serieRotulo, date: toDate(o.refDate), value: o.value });
  });
  const options: LineChartOptions = {
    height: "320px",
    animations: false,
    curve: "curveLinear",
    legend: { enabled: false },
    toolbar: { enabled: false },
    points: { enabled: pontos, radius: 3 },
    color: { scale: { [serieRotulo]: CHART_1 } },
    axes: {
      bottom: { mapsTo: "date", scaleType: ScaleTypes.TIME, title: "Referência" },
      left: {
        mapsTo: "value",
        scaleType: ScaleTypes.LINEAR,
        title: eixo,
        includeZero: false,
        ticks: {
          formatter: (v: number | Date) => formatNumber(Number(v), Math.abs(Number(v)) >= 100 ? 0 : Math.min(casas, 1)),
        },
      },
    },
    tooltip: {
      valueFormatter: (value: unknown, label: string) => {
        if (value instanceof Date) return formatRef(toRef(value), frequencia);
        return label === "x-value" ? String(value) : formatValue(Number(value), unidade, casas);
      },
    },
    locale: { code: "pt-BR", number: (v: number) => formatNumber(v) },
    timeScale: { addSpaceOnEdges: 0 },
  };
  return <LineChart data={data} options={options} />;
}
