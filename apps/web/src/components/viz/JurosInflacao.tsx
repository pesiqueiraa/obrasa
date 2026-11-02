"use client";

// Economia: meta Selic e IPCA em 12 meses no mesmo eixo, mês a mês (DESIGN.md,
// "dual-line"). Duas cores da paleta de gráficos, rótulo direto no fim de cada linha,
// sem legenda separada. As linhas se desenham quando o gráfico entra na tela.
// O desenho usa a largura real da tela (1 unidade = 1px), para o texto ficar sempre
// com 12–13px; antes, o SVG de 720 de largura encolhia e o texto caía para ~5px no celular.
// Mouse ou dedo sobre o gráfico percorre os meses (useLeitura): fio vertical, um ponto em
// cada linha e, acima do gráfico, o mês com os dois valores (fora do alcance do dedo).

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { formatNumber, formatRef } from "@/lib/format";
import { useLeitura } from "./useLeitura";
import styles from "./viz.module.scss";

export type Ponto = { ref: string; v: number }; // ref AAAA-MM

const W_PADRAO = 720; // até medir (render no servidor)
const ESTREITO = 480;

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
  const ref = useRef<HTMLElement>(null);
  const [W, setW] = useState(W_PADRAO);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || W_PADRAO));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const estreito = W < ESTREITO;
  const H = estreito ? 260 : 300;
  const M = { t: 16, r: estreito ? 124 : 132, b: 30, l: estreito ? 28 : 40 };
  const meses = [...new Set([...selic, ...ipca].map((p) => p.ref))].sort();
  const selicMes = new Map(selic.map((p) => [p.ref, p.v]));
  const ipcaMes = new Map(ipca.map((p) => [p.ref, p.v]));
  const { foco, props: leitura } = useLeitura<string, SVGSVGElement>(({ clientX, alvo }) => {
    const box = alvo.getBoundingClientRect();
    const px = (clientX - box.left) * (W / box.width);
    const i = Math.round(((px - M.l) / (W - M.l - M.r)) * (meses.length - 1));
    return meses[Math.min(meses.length - 1, Math.max(0, i))] ?? null;
  });
  const idx = new Map(meses.map((m, i) => [m, i]));
  const vals = [...selic, ...ipca].map((p) => p.v);
  const lo = Math.min(0, Math.floor(Math.min(...vals) / 2) * 2);
  const hi = Math.ceil(Math.max(...vals) / 2) * 2;
  const x = (r: string) => M.l + ((idx.get(r) ?? 0) / Math.max(1, meses.length - 1)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo || 1)) * (H - M.t - M.b);
  const passo = hi - lo > 16 ? 4 : 2;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += passo) ticks.push(t);
  const anos = meses.filter((m) => m.endsWith("-01") && Number(m.slice(0, 4)) % (estreito ? 4 : 2) === 0);
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
    <figure className={styles.figure} ref={ref}>
      <p className={styles.leituraLinha} aria-hidden="true">
        {foco ? (
          <>
            <strong>{formatRef(`${foco}-01`)}</strong>
            <span style={{ color: "var(--bd-color-chart-1)" }}>
              Selic {selicMes.has(foco) ? `${formatNumber(selicMes.get(foco)!)}%` : "sem dado publicado"}
            </span>
            <span style={{ color: "var(--bd-color-chart-2)" }}>
              IPCA 12m {ipcaMes.has(foco) ? `${formatNumber(ipcaMes.get(foco)!)}%` : "sem dado publicado"}
            </span>
          </>
        ) : (
          "Passe o mouse ou o dedo sobre o gráfico para ver cada mês."
        )}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        role="img"
        aria-label={descricao}
        {...leitura}
        style={{ ...leitura.style, cursor: "crosshair" }}
      >
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
        {foco ? (
          <g pointerEvents="none">
            <line x1={x(foco)} x2={x(foco)} y1={M.t} y2={H - M.b} stroke="var(--bd-color-ink-muted)" strokeWidth={1} />
            {[
              [selicMes.get(foco), "var(--bd-color-chart-1)"] as const,
              [ipcaMes.get(foco), "var(--bd-color-chart-2)"] as const,
            ].map(([v, cor]) =>
              v === undefined ? null : (
                <circle key={cor} cx={x(foco)} cy={y(v)} r={4.5} fill="var(--bd-color-canvas)" stroke={cor} strokeWidth={2} />
              ),
            )}
          </g>
        ) : null}
      </svg>
    </figure>
  );
}
