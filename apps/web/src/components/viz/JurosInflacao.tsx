"use client";

// Economia: meta Selic e IPCA em 12 meses no mesmo eixo, mês a mês (DESIGN.md,
// "dual-line"). Duas cores da paleta de gráficos, rótulo direto no fim de cada linha,
// sem legenda separada. As linhas se desenham quando o gráfico entra na tela.

import { motion } from "motion/react";
import { formatNumber } from "@/lib/format";
import styles from "./viz.module.scss";

export type Ponto = { ref: string; v: number }; // ref AAAA-MM

const W = 720;
const H = 300;
const M = { t: 16, r: 132, b: 30, l: 40 };

function path(pts: Ponto[], x: (r: string) => number, y: (v: number) => number) {
  return pts.map((p, i) => `${i ? "L" : "M"}${x(p.ref).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
}

export function JurosInflacao({
  selic,
  ipca,
  descricao,
}: {
  selic: Ponto[];
  ipca: Ponto[];
  descricao: string;
}) {
  const meses = [...new Set([...selic, ...ipca].map((p) => p.ref))].sort();
  const idx = new Map(meses.map((m, i) => [m, i]));
  const vals = [...selic, ...ipca].map((p) => p.v);
  const lo = Math.min(0, Math.floor(Math.min(...vals) / 2) * 2);
  const hi = Math.ceil(Math.max(...vals) / 2) * 2;
  const x = (r: string) => M.l + ((idx.get(r) ?? 0) / Math.max(1, meses.length - 1)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo || 1)) * (H - M.t - M.b);
  const passo = hi - lo > 16 ? 4 : 2;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += passo) ticks.push(t);
  const anos = meses.filter((m) => m.endsWith("-01") && Number(m.slice(0, 4)) % 2 === 0);
  const ultS = selic[selic.length - 1];
  const ultI = ipca[ipca.length - 1];
  const [yS, yI] = [y(ultS.v), y(ultI.v)];
  const afasta = Math.abs(yS - yI) < 28 ? (yS < yI ? [-10, 10] : [10, -10]) : [0, 0];

  const linha = (d: string, cor: string, delay: number) => (
    <motion.path
      d={d}
      fill="none"
      stroke={cor}
      strokeWidth={2}
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 1.4, delay, ease: [0.2, 0, 0.38, 0.9] }}
    />
  );

  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={descricao}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? styles.axisZero : styles.grid} />
            <text x={M.l - 8} y={y(t)} className={styles.tickY}>
              {formatNumber(t, 0)}
            </text>
          </g>
        ))}
        {anos.map((m) => (
          <text key={m} x={x(m)} y={H - 8} className={styles.tickX}>
            {m.slice(0, 4)}
          </text>
        ))}
        {linha(path(ipca, x, y), "var(--bd-color-chart-2)", 0.25)}
        {linha(path(selic, x, y), "var(--bd-color-chart-1)", 0)}
        <motion.g
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: 1.4, duration: 0.3 }}
        >
          <text x={W - M.r + 8} y={yS + afasta[0]} className={styles.endLabel} fill="var(--bd-color-chart-1)">
            Selic {formatNumber(ultS.v)}%
          </text>
          <text x={W - M.r + 8} y={yI + afasta[1]} className={styles.endLabel} fill="var(--bd-color-chart-2)">
            IPCA 12m {formatNumber(ultI.v)}%
          </text>
        </motion.g>
      </svg>
    </figure>
  );
}
