"use client";

// Barra de proporção de um todo (DESIGN.md, "proportion-bar"): a parte em azul-tinta,
// o resto em cinza. Cresce da esquerda quando entra na tela.

import { motion } from "motion/react";
import { formatNumber } from "@/lib/format";
import styles from "./viz.module.scss";

export function ProporcaoBarra({
  value,
  parte,
  resto,
  casas = 1,
}: {
  value: number;
  parte: string;
  resto: string;
  casas?: number;
}) {
  return (
    <div className={styles.prop}>
      <div className={styles.propTrack} role="img" aria-label={`${parte}: ${formatNumber(value, casas)}%. ${resto}: ${formatNumber(100 - value, casas)}%.`}>
        <motion.div
          className={styles.propFill}
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.9, ease: [0.2, 0, 0.38, 0.9] }}
        />
      </div>
      <div className={styles.propLegend} aria-hidden="true">
        <span>
          <strong>{formatNumber(value, casas)}%</strong> {parte}
        </span>
        <span>
          <strong>{formatNumber(100 - value, casas)}%</strong> {resto}
        </span>
      </div>
    </div>
  );
}
