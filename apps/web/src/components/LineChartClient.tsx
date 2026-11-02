"use client";

// Gráfico de linha com @carbon/charts-react (DESIGN.md, "Implementação").
// Uma série: chart-1 (#23408E). A linha pode não começar do zero, mas o eixo fica
// sempre visível e rotulado. Sem animação do Carbon.

import { LineChart } from "@carbon/charts-react";
import { ScaleTypes, type LineChartOptions } from "@carbon/charts";
import "@carbon/charts-react/styles.css";
import { formatNumber, formatRef, formatValue, parseDay, type FrequenciaRef } from "@/lib/format";
import { lacunas, PASSO_MESES } from "@/lib/indicator";

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
  // Período ausente na fonte vira ponto vazio, e a linha é interrompida ali em vez de
  // ligar os vizinhos (ex.: PNAD anual sem 2020 e 2021).
  const data = lacunas(obs, PASSO_MESES[frequencia]).map((o) => ({
    group: serieRotulo,
    date: toDate(o.refDate),
    value: o.lacuna ? null : o.value,
  }));
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
    // a leitura é do LeituraLinha (mouse e dedo); a dica do Carbon fica desligada
    tooltip: {
      enabled: false,
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
