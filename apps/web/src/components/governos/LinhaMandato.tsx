"use client";

// Linha do mandato (aba Governos, bloco 1): o caminho do indicador da posse ao fim, um ponto
// por período. Desenha-se uma vez ao aparecer e o ponto do fim acende no fim do traço
// (DESIGN.md, "Motion"; nada em loop). Passar o mouse ou arrastar o dedo mostra o período e o
// valor do ponto mais próximo (useLeitura). Posse, fim e diferença estão em texto no cartão;
// por isso o gráfico é aria-hidden.

import { motion } from "motion/react";
import { useLeitura } from "@/components/viz/useLeitura";
import styles from "./governos.module.scss";

const W = 300;
const H = 96;
const PAD_X = 6;
const PAD_Y = 10;

export function LinhaMandato({ valores, rotulos, delay = 0 }: { valores: number[]; rotulos: string[]; delay?: number }) {
  const { foco, props: leitura } = useLeitura<number, SVGSVGElement>(({ clientX, alvo }) => {
    const box = alvo.getBoundingClientRect();
    const t = (clientX - box.left) / box.width;
    return Math.min(valores.length - 1, Math.max(0, Math.round(t * (valores.length - 1))));
  });
  if (valores.length < 2) return null;
  const temNegativo = valores.some((v) => v < 0);
  const min = Math.min(...valores, ...(temNegativo ? [0] : []));
  const max = Math.max(...valores, ...(temNegativo ? [0] : []));
  const span = max - min || 1;
  const x = (i: number) => PAD_X + (i / (valores.length - 1)) * (W - PAD_X * 2);
  const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (H - PAD_Y * 2);
  const d = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ultimo = valores.length - 1;
  const cruzaZero = min < 0 && max > 0;
  const fx = foco !== null ? x(foco) : 0;
  const vista = { once: true, amount: 0.6 } as const;
  return (
    <div className={styles.linha}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={styles.linhaSvg}
        aria-hidden="true"
        focusable="false"
        {...leitura}
        style={{ ...leitura.style, cursor: "crosshair" }}
      >
        {cruzaZero ? (
          <line
            x1={0}
            x2={W}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--bd-color-ink-muted)"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <motion.path
          d={d}
          fill="none"
          stroke="var(--bd-color-chart-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          // sem vector-effect: com pathLength, o traço escalado sairia mais curto que a linha
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={vista}
          transition={{ duration: 1.1, delay, ease: [0.2, 0, 0.38, 0.9] }}
        />
        {foco !== null ? (
          <line
            x1={fx}
            x2={fx}
            y1={0}
            y2={H}
            stroke="var(--bd-color-ink-muted)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ) : null}
      </svg>
      {/* Pontos em HTML: com preserveAspectRatio="none", um círculo no SVG viraria elipse. */}
      <motion.span
        className={styles.pontoPosse}
        style={{ left: `${(x(0) / W) * 100}%`, top: `${(y(valores[0]) / H) * 100}%` }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={vista}
        transition={{ duration: 0.2, delay }}
      />
      <motion.span
        className={styles.pontoFim}
        style={{ left: `${(x(ultimo) / W) * 100}%`, top: `${(y(valores[ultimo]) / H) * 100}%` }}
        initial={{ opacity: 0, scale: 0.4 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={vista}
        transition={{ duration: 0.25, delay: delay + 1.05 }}
      />
      {foco !== null ? (
        <>
          <span
            className={styles.pontoFoco}
            style={{ left: `${(fx / W) * 100}%`, top: `${(y(valores[foco]) / H) * 100}%` }}
          />
          <span
            aria-hidden="true"
            className={styles.leitura}
            style={{ left: `${(fx / W) * 100}%`, transform: `translateX(${fx > W / 2 ? "-100%" : "0"})` }}
          >
            {rotulos[foco]}
          </span>
        </>
      ) : null}
    </div>
  );
}
