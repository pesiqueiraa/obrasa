"use client";

// Minilinha de tendência (DESIGN.md, "sparkline"). Decorativa: o valor, a variação e a
// janela estão em texto ao lado, por isso aria-hidden. Desenha-se uma vez ao aparecer.

import { motion } from "motion/react";

export function Sparkline({
  values,
  width = 120,
  height = 36,
  delay = 0,
}: {
  values: number[];
  width?: number;
  height?: number;
  delay?: number;
}) {
  if (values.length < 2) return null;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
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
    </svg>
  );
}
