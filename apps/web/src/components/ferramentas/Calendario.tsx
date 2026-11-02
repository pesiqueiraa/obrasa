"use client";

// Agenda em forma de calendário (DESIGN.md, "Ferramentas"). Um mês por vez; cada dia
// mostra quem divulga o quê. Clicar num dia abre a lista do dia; embaixo, a lista do mês
// inteiro (no celular, a grade só marca os dias e a lista faz o trabalho).

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { addMonths, formatDate, monthLong } from "@/lib/format";
import type { Evento } from "@/lib/agenda";
import styles from "./ferramentas.module.scss";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function diasDoMes(mes: string): (string | null)[] {
  const [y, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: (string | null)[] = Array.from({ length: primeiro }, () => null);
  for (let d = 1; d <= total; d++) out.push(`${mes}-${String(d).padStart(2, "0")}`);
  while (out.length % 7) out.push(null);
  return out;
}

/** O evento ocupa o dia? (reunião do Copom: do primeiro dia à decisão) */
const noDia = (e: Evento, dia: string) => e.inicio <= dia && dia <= e.data;

export function Calendario({ eventos, hoje, de, ate }: { eventos: Evento[]; hoje: string; de: string; ate: string }) {
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [dir, setDir] = useState(0);
  const [dia, setDia] = useState<string | null>(null);
  const reduz = useReducedMotion();
  const primeiro = de.slice(0, 7);
  const ultimo = addMonths(ate, -1).slice(0, 7);
  const vai = (d: number) => {
    setDir(d);
    setDia(null);
    setMes(addMonths(`${mes}-01`, d).slice(0, 7));
  };
  const doMes = eventos.filter((e) => e.data.startsWith(mes) || e.inicio.startsWith(mes));
  const lista = dia ? doMes.filter((e) => noDia(e, dia)) : doMes;

  return (
    <div className={styles.agenda}>
      <div className={styles.mesBarra}>
        <button type="button" onClick={() => vai(-1)} disabled={mes <= primeiro} aria-label="Mês anterior">
          ‹
        </button>
        <h2 aria-live="polite">{monthLong(`${mes}-01`)}</h2>
        <button type="button" onClick={() => vai(1)} disabled={mes >= ultimo} aria-label="Próximo mês">
          ›
        </button>
      </div>

      <div className={styles.grade}>
        <div className={styles.semana} aria-hidden="true">
          {SEMANA.map((s) => (
            <span key={s}>
              {s}
            </span>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={mes}
            className={styles.dias}
            custom={dir}
            variants={{
              entra: (d: number) => ({ x: reduz ? 0 : d * 32, opacity: 0 }),
              fica: { x: 0, opacity: 1 },
              sai: (d: number) => ({ x: reduz ? 0 : -d * 32, opacity: 0 }),
            }}
            initial="entra"
            animate="fica"
            exit="sai"
            transition={{ duration: reduz ? 0 : 0.18, ease: [0.2, 0, 0.38, 0.9] }}
          >
            {diasDoMes(mes).map((d, i) => {
              if (!d) return <span key={`v${i}`} className={styles.vazio} aria-hidden="true" />;
              const evs = eventos.filter((e) => noDia(e, d));
              const n = Number(d.slice(8));
              return (
                <button
                  key={d}
                  type="button"
                  className={styles.dia}
                  data-hoje={d === hoje || undefined}
                  data-passado={d < hoje || undefined}
                  aria-pressed={dia === d}
                  aria-label={`${n}${evs.length ? `, ${evs.length} ${evs.length > 1 ? "eventos" : "evento"}` : ""}`}
                  onClick={() => setDia(dia === d ? null : d)}
                  disabled={!evs.length}
                >
                  <span className={styles.diaN}>{n}</span>
                  {evs.slice(0, 2).map((e) => (
                    <span key={e.id} className={styles.marca} data-orgao={e.orgao === "IBGE" ? "ibge" : "bc"}>
                      {e.curto}
                    </span>
                  ))}
                  {evs.length > 2 ? <span className={styles.mais}>+{evs.length - 2}</span> : null}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.legenda} aria-hidden="true">
        <span data-orgao="ibge">IBGE</span>
        <span data-orgao="bc">Banco Central</span>
      </div>

      <section className={styles.listaDia} aria-live="polite">
        <h3>
          {dia ? formatDate(dia) : `Tudo em ${monthLong(`${mes}-01`)}`}
          {dia ? (
            <button type="button" onClick={() => setDia(null)}>
              ver o mês inteiro
            </button>
          ) : null}
        </h3>
        {lista.length ? (
          <ol>
            {lista.map((e) => (
              <li key={e.id} data-passado={e.ja || undefined}>
                <span className={styles.quando}>
                  {e.inicio !== e.data ? `${formatDate(e.inicio).slice(0, 5)} e ` : ""}
                  {formatDate(e.data).slice(0, 5)}
                </span>
                <div>
                  <p className={styles.oque}>
                    <span className={styles.orgao} data-orgao={e.orgao === "IBGE" ? "ibge" : "bc"}>
                      {e.orgao}
                    </span>{" "}
                    {e.verbo === "decide" ? (e.ja ? "decidiu" : "decide") : e.ja ? "divulgou" : "divulga"}:{" "}
                    {e.itens.map((it, k) => (
                      <span key={it.href}>
                        {k ? ", " : ""}
                        <Link href={it.href}>{it.rotulo}</Link>
                      </span>
                    ))}
                  </p>
                  <p className={styles.ref}>
                    {e.titulo}
                    {e.fonte ? (
                      <>
                        {" "}
                        (
                        <a href={e.fonte} rel="noopener">
                          calendário do {e.orgao === "IBGE" ? "IBGE" : "BC"}
                        </a>
                        )
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.aviso}>Nenhuma divulgação marcada neste mês até agora.</p>
        )}
      </section>
    </div>
  );
}
