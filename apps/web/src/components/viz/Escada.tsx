"use client";

// Escada de instrução (DESIGN.md, "education-steps"): uma barra de 100% por ano, com as
// pessoas divididas por nível de instrução, do menor (tom claro) ao maior (tom escuro).
// Anos sem pesquisa aparecem como linha vazia, nunca preenchidos por estimativa.
// As barras crescem uma vez, de cima para baixo, quando entram na tela.

import { motion } from "motion/react";
import { formatNumber } from "@/lib/format";
import styles from "./viz.module.scss";

export type DegrauAno = { ano: string; partes: number[] | null };

export function Escada({ niveis, anos, descricao }: { niveis: string[]; anos: DegrauAno[]; descricao: string }) {
  const ultimo = [...anos].reverse().find((a) => a.partes);
  return (
    <figure className={styles.escada}>
      <ul className={styles.escadaLegenda} aria-hidden="true">
        {niveis.map((n, i) => (
          <li key={n}>
            <span className={`${styles.escadaChave} ${styles[`nivel${i}`]}`} />
            {n}
          </li>
        ))}
      </ul>
      <motion.div role="img" aria-label={descricao} initial="oculto" whileInView="visivel" viewport={{ once: true, amount: 0.4 }}>
        {anos.map((a, linha) => (
          <div key={a.ano} className={styles.escadaLinha} aria-hidden="true">
            <span className={styles.escadaAno}>{a.ano}</span>
            {a.partes ? (
              <motion.div
                className={styles.escadaBarra}
                style={{ transformOrigin: "left center" }}
                variants={{
                  oculto: { scaleX: 0 },
                  visivel: { scaleX: 1, transition: { duration: 0.6, delay: linha * 0.05, ease: [0.2, 0, 0.38, 0.9] } },
                }}
              >
                {a.partes.map((p, i) => (
                  <span key={i} className={styles[`nivel${i}`]} style={{ flexGrow: p }}>
                    {a === ultimo && p >= 8 ? `${formatNumber(p, 1)}%` : null}
                  </span>
                ))}
              </motion.div>
            ) : (
              <span className={styles.escadaVazia}>sem dado publicado</span>
            )}
          </div>
        ))}
      </motion.div>
    </figure>
  );
}
