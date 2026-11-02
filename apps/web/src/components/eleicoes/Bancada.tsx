"use client";

// Bancadas eleitas: um quadrado por cadeira, agrupados por partido na ordem do número de
// eleitos (empate: ordem alfabética). Não há eixo esquerda–direita: a ordem é só o
// tamanho. Grupos vizinhos alternam dois tons da mesma cor, para ver onde cada um termina.
// Passar o mouse, o foco ou o dedo num partido da lista destaca as cadeiras dele. No
// toque, o destaque fica até tocar em outro partido ou fora da lista (no iPhone, tocar
// num botão não lhe dá foco, então o foco sozinho não serve).

import { useEffect, useRef, useState } from "react";
import styles from "./eleicoes.module.scss";

export function Bancada({ titulo, partidos, colunas }: { titulo: string; partidos: { partido: string; eleitos: number }[]; colunas: number }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const lista = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!ativo) return;
    const fora = (e: PointerEvent) => {
      if (!lista.current?.contains(e.target as Node)) setAtivo(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [ativo]);
  const ordem = [...partidos].sort((a, b) => b.eleitos - a.eleitos || a.partido.localeCompare(b.partido));
  const total = ordem.reduce((s, p) => s + p.eleitos, 0);
  const cadeiras = ordem.flatMap((p, i) => Array.from({ length: p.eleitos }, () => ({ partido: p.partido, tom: i % 2 })));
  return (
    <figure className={styles.bancada}>
      <figcaption className={styles.bancadaTitulo}>
        {titulo}: {total} cadeiras, {ordem.length} partidos
      </figcaption>
      <div
        className={styles.cadeiras}
        style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)` }}
        aria-hidden="true"
      >
        {cadeiras.map((c, i) => (
          <span
            key={i}
            className={`${styles.cadeira} ${c.tom ? styles.tom2 : ""} ${ativo && ativo !== c.partido ? styles.apagada : ""}`}
          />
        ))}
      </div>
      <ul className={styles.partidos} ref={lista}>
        {ordem.map((p, i) => (
          <li key={p.partido}>
            <button
              type="button"
              className={styles.partidoBtn}
              aria-pressed={ativo === p.partido}
              onMouseEnter={() => setAtivo(p.partido)}
              onMouseLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(p.partido)}
              onBlur={() => setAtivo(null)}
              onClick={() => setAtivo(p.partido)}
            >
              <span className={`${styles.chave} ${i % 2 ? styles.tom2 : styles.tom1}`} aria-hidden="true" />
              {p.partido} <strong>{p.eleitos}</strong>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}
