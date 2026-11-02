"use client";

// Gráfico de linha com @carbon/charts-react (DESIGN.md, "Implementação").
// Uma série: chart-1 (#23408E). Linha pode não começar do zero, mas o eixo fica
// sempre visível e rotulado. Sem animação.

import { LineChart } from "@carbon/charts-react";
import { ScaleTypes, type LineChartOptions } from "@carbon/charts";
import "@carbon/charts-react/styles.css";
import { formatNumber, monthShort, parseRef } from "@/lib/format";
import type { Obs } from "@/lib/indicator";

const CHART_1 = "#23408E";

function toDate(ref: string): Date {
  const [y, m] = parseRef(ref);
  return new Date(y, m - 1, 1);
}

function toRef(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function LineChartClient({
  obs,
  serieRotulo,
  unidade,
  pontos,
}: {
  obs: Obs[];
  serieRotulo: string;
  unidade: string;
  pontos: boolean;
}) {
  const data = obs.map((o) => ({ group: serieRotulo, date: toDate(o.refDate), value: o.value }));
  const options: LineChartOptions = {
    height: "320px",
    animations: false,
    curve: "curveLinear",
    legend: { enabled: false },
    toolbar: { enabled: false },
    points: { enabled: pontos, radius: 3 },
    color: { scale: { [serieRotulo]: CHART_1 } },
    axes: {
      bottom: { mapsTo: "date", scaleType: ScaleTypes.TIME, title: "Mês de referência" },
      left: {
        mapsTo: "value",
        scaleType: ScaleTypes.LINEAR,
        title: unidade === "%" ? "% acumulado em 12 meses" : unidade,
        includeZero: false,
        ticks: { formatter: (v: number | Date) => formatNumber(Number(v), Math.abs(Number(v)) >= 100 ? 0 : 1) },
      },
    },
    tooltip: {
      valueFormatter: (value: unknown, label: string) => {
        if (value instanceof Date) return monthShort(toRef(value));
        return label === "x-value" ? String(value) : `${formatNumber(Number(value))}${unidade === "%" ? "%" : ""}`;
      },
    },
    locale: { code: "pt-BR", number: (v: number) => formatNumber(v) },
    timeScale: { addSpaceOnEdges: 0 },
  };
  return <LineChart data={data} options={options} />;
}
