"use client";

// Meta de inflação por ano (aba Governos, bloco 2; DESIGN.md, `target-ruler`). Uma régua por
// ano, todas na mesma escala: a faixa aceita (intervalo de tolerância) em cinza, o alvo (a
// meta) como traço e a inflação que aconteceu (IPCA de dezembro) como ponto. Ao entrar na
// tela, o ponto sai do alvo e desliza até o valor real, uma vez. A legenda acima das réguas
// ensina a leitura. A frase de cada ano diz só a
// posição do número em relação à faixa; a carta aberta do Banco Central é citada com link,
// sem veredito do oBrasa (docs/02, seção 10). Mesma cor dentro ou fora da faixa.

import { motion } from "motion/react";
import { formatNumber } from "@/lib/format";
import styles from "./governos.module.scss";

export type AnoMeta = {
  ano: number;
  meta: number;
  inferior: number;
  superior: number;
  ipca: number | null;
  carta: string | null;
  detalhe: string[];
};

const pct = (n: number) => `${formatNumber(n, 2)}%`;

function posicao(a: AnoMeta): string {
  if (a.ipca === null) return `IPCA de dez/${a.ano} ainda não divulgado`;
  if (a.ipca > a.superior) return "acima da faixa aceita";
  if (a.ipca < a.inferior) return "abaixo da faixa aceita";
  return "dentro da faixa aceita";
}

export function MetasGrafico({ anos }: { anos: AnoMeta[] }) {
  const topo = Math.ceil(Math.max(...anos.flatMap((a) => [a.superior, a.ipca ?? 0])) / 2) * 2;
  const x = (v: number) => `${(Math.max(0, v) / topo) * 100}%`;
  const marcas = Array.from({ length: topo / 2 + 1 }, (_, i) => i * 2);
  const vista = { once: true, amount: 0.8 } as const;
  return (
    <div className={styles.regua}>
      <p className={styles.legenda} aria-hidden="true">
        <span className={styles.legFaixa} /> faixa aceita <span className={styles.legMeta} /> alvo{" "}
        <span className={styles.legPonto} /> inflação do ano
      </p>
      <ol className={styles.reguaAnos}>
        {anos.map((a, i) => (
          <li key={a.ano} className={styles.reguaLinha}>
            <span className={styles.reguaAno}>{a.ano}</span>
            <div className={styles.reguaTrilho} aria-hidden="true">
              {marcas.map((m) => (
                <span key={m} className={styles.reguaGrade} style={{ left: x(m) }} />
              ))}
              <motion.span
                className={styles.reguaFaixa}
                style={{ left: x(a.inferior), width: `calc(${x(a.superior)} - ${x(a.inferior)})`, originX: 0.5 }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={vista}
                transition={{ duration: 0.4, delay: 0.05 * i }}
              />
              <span className={styles.reguaAlvo} style={{ left: x(a.meta) }} />
              {a.ipca !== null ? (
                <motion.span
                  className={styles.reguaPonto}
                  initial={{ left: x(a.meta), opacity: 0 }}
                  whileInView={{ left: x(a.ipca), opacity: 1 }}
                  viewport={vista}
                  transition={{ type: "spring", stiffness: 90, damping: 15, delay: 0.3 + 0.05 * i }}
                />
              ) : null}
            </div>
            <span className={styles.reguaValor}>{a.ipca !== null ? pct(a.ipca) : "–"}</span>
            <p className={styles.reguaFrase}>
              Alvo {pct(a.meta)}, aceito de {pct(a.inferior)} a {pct(a.superior)}. Inflação: {posicao(a)}.
              {a.carta ? (
                <>
                  {" "}
                  <a href={a.carta} rel="noopener">
                    Carta do Banco Central explicando o resultado (PDF)
                  </a>
                </>
              ) : null}
              <span className={styles.reguaNorma}>{a.detalhe.join(" · ")}</span>
            </p>
          </li>
        ))}
      </ol>
      <div className={styles.reguaEixo} aria-hidden="true">
        {marcas.map((m) => (
          <span key={m} style={{ left: x(m) }}>
            {m}%
          </span>
        ))}
      </div>
    </div>
  );
}
