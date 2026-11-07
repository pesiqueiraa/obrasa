"use client";

// Linha do tempo da reforma tributária e do imposto de renda (docs/10, 2.7). Estilo da
// `release-agenda` do DESIGN.md: linha vertical de 2px em ink, marcador quadrado, ano em
// 32px light. Cada marco cita lei, artigo e link do Planalto (docs/02, seção 9). O filtro
// "Para quem" só esconde marcos; não muda texto nenhum.

import { useState } from "react";
import type { Marco } from "@/lib/impostos";
import styles from "./impostos.module.scss";

const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "pf", rotulo: "Pessoa física" },
  { id: "pj", rotulo: "Empresa" },
] as const;

const PUBLICO = { pf: "Pessoa física", pj: "Empresa" } as const;

export function LinhaDoTempo({ marcos, hoje }: { marcos: Marco[]; hoje: string }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");
  const visiveis = filtro === "todos" ? marcos : marcos.filter((m) => m.publico.includes(filtro));
  const anos = [...new Set(visiveis.map((m) => m.vigencia.slice(0, 4)))];
  return (
    <div>
      <div className={styles.filtro} role="group" aria-label="Para quem">
        <span>Para quem:</span>
        {FILTROS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.rotulo}
          </button>
        ))}
      </div>
      <ol className={styles.tempo}>
        {anos.map((ano) => (
          <li key={ano} className={styles.ano} data-passado={`${ano}-12-31` < hoje || undefined}>
            <h3 className={styles.anoRotulo}>{ano}</h3>
            <ul className={styles.marcos}>
              {visiveis
                .filter((m) => m.vigencia.startsWith(ano))
                .map((m) => (
                  <li key={m.id} className={styles.marco}>
                    <h4>{m.titulo}</h4>
                    <p>{m.texto}</p>
                    <p className={styles.marcoMeta}>
                      <span>{m.publico.map((p) => PUBLICO[p]).join(" e ")}</span>
                      {" · "}
                      <a href={m.url} rel="noopener">
                        {m.lei}
                      </a>
                      {m.conferidoEm === null ? (
                        <strong className={styles.rascunho}> rascunho, sem conferência</strong>
                      ) : null}
                    </p>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
