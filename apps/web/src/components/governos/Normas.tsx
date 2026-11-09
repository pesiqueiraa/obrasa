"use client";

// Bloco 4 da aba Governos (DESIGN.md, `mandate-laws`): todas as emendas à Constituição e
// leis complementares assinadas no mandato, da lista do Senado. Os contadores são também
// filtros (Todas, Impostos, Emendas, Leis complementares). Cada norma mostra a data, o nome,
// a ementa oficial sem reescrita e o link para o texto no normas.leg.br. "Impostos" vem do
// critério público sobre a ementa (config/governos.yaml), não de escolha caso a caso. Ordem
// por data; mostra 6 e abre o resto a pedido. Itens entram com fade ao trocar de filtro.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import ui from "@/components/ui.module.scss";
import { formatDate, todayInBrazil } from "@/lib/format";
import type { BlocoNormas, NormaFederal } from "@/lib/governos";
import styles from "./governos.module.scss";

type Filtro = "todas" | "impostos" | "EMC" | "LCP";

const INICIAL = 6;

function rotulo(n: NormaFederal): string {
  return n.tipo === "EMC" ? `Emenda Constitucional ${n.numero}` : `Lei Complementar ${n.numero}`;
}

export function Normas({ bloco }: { bloco: BlocoNormas }) {
  const { normas, fonte } = bloco;
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [todas, setTodas] = useState(false);
  const filtros: { id: Filtro; n: number; texto: string }[] = [
    { id: "todas", n: normas.length, texto: "no total" },
    { id: "impostos", n: normas.filter((x) => x.impostos).length, texto: "sobre impostos" },
    { id: "EMC", n: normas.filter((x) => x.tipo === "EMC").length, texto: "emendas à Constituição" },
    { id: "LCP", n: normas.filter((x) => x.tipo === "LCP").length, texto: "leis complementares" },
  ];
  const lista = normas.filter((x) =>
    filtro === "todas" ? true : filtro === "impostos" ? x.impostos : x.tipo === filtro,
  );
  const visiveis = todas ? lista : lista.slice(0, INICIAL);
  return (
    <>
      <div className={styles.filtros} role="group" aria-label="Filtrar normas">
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            className={styles.filtro}
            onClick={() => {
              setFiltro(f.id);
              setTodas(false);
            }}
          >
            <span className={styles.filtroN}>{f.n}</span>
            <span>{f.texto}</span>
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <p className={ui.caption}>Nenhuma norma deste tipo assinada no período.</p>
      ) : (
        <ol className={styles.normas}>
          <AnimatePresence initial={false} mode="popLayout">
            {visiveis.map((n) => (
              <motion.li
                key={`${n.tipo}-${n.numero}`}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className={styles.norma}
              >
                <span className={styles.normaData}>{formatDate(n.data)}</span>
                <div>
                  <p className={styles.normaNome}>
                    <a href={n.url} rel="noopener">
                      {rotulo(n)}
                    </a>
                    {n.impostos ? <span className={styles.selo}>Impostos</span> : null}
                  </p>
                  <p className={styles.normaEmenta}>{n.ementa}</p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      {lista.length > INICIAL ? (
        <button type="button" className={styles.verMais} onClick={() => setTodas((v) => !v)} aria-expanded={todas}>
          {todas ? "Mostrar menos" : `Ver todas (${lista.length})`}
        </button>
      ) : null}
      <p className={ui.sourceLine}>
        Fonte:{" "}
        {fonte ? (
          <>
            <a href={fonte.url} rel="noopener">
              {fonte.orgao}
            </a>
            , legislação federal ({formatDate(todayInBrazil(new Date(fonte.coletadoEm)))})
          </>
        ) : (
          "Senado Federal"
        )}
        . Ementa oficial de cada norma; texto completo no normas.leg.br.
      </p>
    </>
  );
}
