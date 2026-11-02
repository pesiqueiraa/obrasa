"use client";

// Barra que cresce da esquerda uma vez, quando entra na tela (DESIGN.md, Movimento).

import { motion } from "motion/react";

export function BarraCresce({ largura, atraso = 0, className }: { largura: number; atraso?: number; className?: string }) {
  return (
    <motion.span
      className={className}
      style={{ display: "block", height: "100%" }}
      initial={{ width: 0 }}
      whileInView={{ width: `${largura}%` }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.8, delay: atraso, ease: [0.2, 0, 0.38, 0.9] }}
    />
  );
}
