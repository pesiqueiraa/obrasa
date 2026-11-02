"use client";

// Trabalho: "de cada 100 pessoas na força de trabalho" (DESIGN.md, "waffle").
// 100 quadrados; os preenchidos são o valor do banco, com o último quadrado preenchido
// só na fração decimal (5,6 → 5 inteiros e 60% do sexto). Sem arredondar o dado.

import { motion } from "motion/react";
import styles from "./viz.module.scss";

const LADO = 14;
const GAP = 3;
const PASSO = LADO + GAP;

export function Waffle({ value, rotulo, apagado = false }: { value: number; rotulo: string; apagado?: boolean }) {
  const cheios = Math.floor(value);
  const fracao = value - cheios;
  const total = PASSO * 10 - GAP;
  return (
    <figure className={`${styles.waffle} ${apagado ? styles.waffleMuted : ""}`}>
      <svg viewBox={`0 0 ${total} ${total}`} width={total} height={total} role="img" aria-label={rotulo}>
        {Array.from({ length: 100 }, (_, i) => {
          const col = i % 10;
          const row = Math.floor(i / 10);
          const px = col * PASSO;
          const py = row * PASSO;
          const fill = i < cheios ? 1 : i === cheios ? fracao : 0;
          return (
            <g key={i}>
              <rect x={px} y={py} width={LADO} height={LADO} className={styles.cell} />
              {fill > 0 ? (
                <motion.rect
                  x={px}
                  y={py}
                  width={LADO * fill}
                  height={LADO}
                  className={styles.cellOn}
                  initial={{ opacity: 0, scale: 0.4 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.25 }}
                  style={{ transformOrigin: `${px + LADO / 2}px ${py + LADO / 2}px` }}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption>{rotulo}</figcaption>
    </figure>
  );
}
