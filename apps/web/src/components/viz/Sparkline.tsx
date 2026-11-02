"use client";

// Minilinha de tendência (DESIGN.md, "sparkline"). Decorativa: o valor, a variação e a
// janela estão em texto ao lado, por isso aria-hidden. Desenha-se uma vez ao aparecer.
// Com `rotulos`, passar o mouse ou arrastar o dedo mostra o período e o valor do ponto
// mais próximo (um fio, um ponto e uma etiqueta; useLeitura); parado, nada além da linha.

import { motion } from "motion/react";
import { useLeitura } from "./useLeitura";

export function Sparkline({
  values,
  width = 120,
  height = 36,
  delay = 0,
  rotulos,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  delay?: number;
  rotulos?: (string | null)[];
}) {
  const pad = 3;
  const { foco, props: leitura } = useLeitura<number, SVGSVGElement>(({ clientX, alvo }) => {
    const box = alvo.getBoundingClientRect();
    const alvoI = Math.round(((clientX - box.left - pad) / (box.width - pad * 2)) * (values.length - 1));
    // o ponto com dado mais próximo (pula períodos que a fonte não publicou)
    let melhor: number | null = null;
    values.forEach((v, i) => {
      if (v !== null && (melhor === null || Math.abs(i - alvoI) < Math.abs(melhor - alvoI))) melhor = i;
    });
    return melhor;
  });
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  // período sem dado (null) interrompe a linha: o ponto seguinte recomeça com "M"
  const d = values
    .map((v, i) =>
      v === null ? "" : `${i && values[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`,
    )
    .join(" ");
  const lastX = x(values.length - 1);
  const lastY = y(nums[nums.length - 1]);
  const fv = foco !== null ? values[foco] : null;
  const svg = (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      {...(rotulos ? leitura : {})}
      style={rotulos ? { ...leitura.style, cursor: "crosshair", position: "relative", zIndex: 1 } : undefined}
    >
      <motion.path
        d={d}
        fill="none"
        stroke="var(--bd-color-chart-1)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay, ease: [0.2, 0, 0.38, 0.9] }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r={2.5}
        fill="var(--bd-color-chart-1)"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.2, delay: delay + 0.85 }}
      />
      {foco !== null && fv != null ? (
        <g pointerEvents="none">
          <line x1={x(foco)} x2={x(foco)} y1={0} y2={height} stroke="var(--bd-color-ink-muted)" strokeWidth={1} />
          <circle cx={x(foco)} cy={y(fv)} r={3.5} fill="var(--bd-color-canvas)" stroke="var(--bd-color-chart-1)" strokeWidth={2} />
        </g>
      ) : null}
    </svg>
  );
  if (!rotulos) return svg;
  const rotulo = foco !== null ? rotulos[foco] : null;
  return (
    <span style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
      {svg}
      {rotulo ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "100%",
            left: Math.min(Math.max(x(foco!), 0), width),
            transform: `translateX(${x(foco!) > width / 2 ? "-100%" : "0"})`,
            marginBottom: 4,
            background: "var(--bd-color-ink)",
            color: "var(--bd-color-canvas)",
            font: "600 12px/1.4 var(--bd-type-body-sm-font-family, inherit)",
            fontVariantNumeric: "tabular-nums",
            padding: "2px 6px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {rotulo}
        </span>
      ) : null}
    </span>
  );
}
