"use client";

// Contas públicas: régua de 0 a 100% do PIB (DESIGN.md, "pib-ruler"). Para cada
// dívida, a faixa cinza vai do menor ao maior valor da série no banco, e o marcador
// azul-tinta mostra o valor atual. A régua continua além de 100 se algum valor passar.

import { motion } from "motion/react";
import Link from "next/link";
import styles from "./viz.module.scss";

export type LinhaRegua = {
  slug: string;
  titulo: string;
  valor: number;
  valorTexto: string;
  ref: string;
  min: { v: number; texto: string };
  max: { v: number; texto: string };
};

export function Regua({ linhas }: { linhas: LinhaRegua[] }) {
  const teto = Math.max(100, ...linhas.map((l) => Math.ceil(l.max.v / 10) * 10));
  const pct = (v: number) => `${(Math.max(0, v) / teto) * 100}%`;
  const marcas = Array.from({ length: teto / 10 + 1 }, (_, i) => i * 10);
  return (
    <div className={styles.regua}>
      <div className={styles.reguaScale} aria-hidden="true">
        {marcas.map((m) => (
          <span key={m} style={{ left: pct(m) }} className={m % 50 === 0 ? styles.tickMajor : styles.tick}>
            {m % 50 === 0 ? <span className={styles.tickLabel}>{m}% do PIB</span> : null}
          </span>
        ))}
      </div>
      {linhas.map((l, i) => (
        <div key={l.slug} className={styles.reguaRow}>
          <p className={styles.reguaTitle}>
            <Link href={`/indicador/${l.slug}`} className="toque">{l.titulo}</Link>
            <span className={styles.reguaValue}>
              {l.valorTexto} <span className={styles.reguaRef}>em {l.ref}</span>
            </span>
          </p>
          <div className={styles.reguaTrack}>
            <motion.div
              className={styles.reguaBand}
              style={{ left: pct(l.min.v), transformOrigin: "left" }}
              initial={{ width: 0 }}
              whileInView={{ width: `calc(${pct(l.max.v)} - ${pct(l.min.v)})` }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.7, delay: i * 0.15 }}
            />
            <motion.div
              className={styles.reguaMarker}
              initial={{ left: pct(l.min.v), opacity: 0 }}
              whileInView={{ left: pct(l.valor), opacity: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.8, delay: 0.5 + i * 0.15, ease: [0.2, 0, 0.38, 0.9] }}
            />
          </div>
          <p className={styles.reguaRange}>
            Menor da série: {l.min.texto}. Maior: {l.max.texto}.
          </p>
        </div>
      ))}
    </div>
  );
}
