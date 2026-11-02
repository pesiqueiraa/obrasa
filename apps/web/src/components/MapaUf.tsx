"use client";

// Mapa por estado (DESIGN.md, "mapa-uf"). Um tom só, em 5 faixas de mesmo tamanho entre
// o menor e o maior valor do período mostrado; a legenda muda junto com o período. Divisas entre
// estados em traço grosso, para cada UF se separar da vizinha. Ao lado, os 27 estados em
// ordem; passar o mouse (ou tocar) num estado destaca o mesmo estado na lista e no mapa.

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, useState } from "react";
import { limites } from "@/lib/contas";
import { formatRef, formatValue } from "@/lib/format";
import type { DesenhoUf, MapaUfDados } from "@/lib/regional";
import ui from "./ui.module.scss";
import styles from "./mapaUf.module.scss";

const W = 600;
const H = 600;

function faixa(v: number, lim: number[]): number {
  for (let i = 1; i < 5; i++) if (v < lim[i]) return i - 1;
  return 4;
}

export function MapaUf({ mapas, desenho }: { mapas: MapaUfDados[]; desenho: DesenhoUf }) {
  const [k, setK] = useState(0);
  const m = mapas[k];
  const [p, setP] = useState(m.periodos.length - 1);
  const [foco, setFoco] = useState<number | null>(null);
  const reduz = useReducedMotion();
  const idRange = useId();

  const i = Math.min(p, m.periodos.length - 1);
  const ref = m.periodos[i];
  const vals = m.valores[ref];
  const fmt = (v: number) => formatValue(v, m.unidade, m.casas);
  const periodo = (r: string) => formatRef(r, m.frequencia);
  const ordem = Object.entries(vals)
    .map(([uf, v]) => ({ uf: Number(uf), v }))
    .sort((a, b) => b.v - a.v || m.nomes[a.uf].localeCompare(m.nomes[b.uf]));
  const lim = limites(Object.values(vals), m.casas);
  const max = lim[5];
  const trocaMapa = (j: number) => {
    setK(j);
    setP(mapas[j].periodos.length - 1);
  };
  const focado = foco != null ? desenho.ufs.find((u) => u.uf === foco) : null;

  return (
    <div className={styles.mapaUf} data-reduz={reduz || undefined}>
      <div className={styles.topo}>
        {mapas.length > 1 ? (
          <div className={styles.segmentos} role="radiogroup" aria-label="Indicador do mapa">
            {mapas.map((x, j) => (
              <button key={x.id} type="button" role="radio" aria-checked={j === k} onClick={() => trocaMapa(j)}>
                {x.titulo.split(" por estado")[0]}
              </button>
            ))}
          </div>
        ) : null}
        <h3 className={styles.titulo}>
          {m.titulo}, {periodo(ref)}
        </h3>
        {m.periodos.length > 1 ? (
          <div className={styles.periodo}>
            <label htmlFor={idRange}>Período</label>
            <input
              id={idRange}
              type="range"
              min={0}
              max={m.periodos.length - 1}
              value={i}
              onChange={(e) => setP(Number(e.target.value))}
              aria-valuetext={periodo(ref)}
            />
            <span>
              {periodo(m.periodos[0])} a {periodo(m.periodos.at(-1)!)}
            </span>
          </div>
        ) : null}
      </div>

      <div className={styles.corpo}>
        <div className={styles.caixa} onPointerLeave={() => setFoco(null)}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Mapa do Brasil por estado: ${m.titulo.toLowerCase()}, ${periodo(ref)}. A lista ao lado traz os mesmos números.`}
          >
            {desenho.ufs.map((u) => (
              <path
                key={u.uf}
                d={u.d}
                className={styles[`b${faixa(vals[u.uf], lim)}`]}
                onPointerEnter={() => setFoco(u.uf)}
                onClick={() => setFoco(u.uf)}
              />
            ))}
            <path d={desenho.divisas} className={styles.divisa} />
            <path d={desenho.borda} className={styles.borda} />
            {focado ? <path d={focado.d} className={styles.foco} /> : null}
          </svg>
          <ul className={styles.escala} aria-label="Faixas de cor">
            {[0, 1, 2, 3, 4].map((b) => (
              <li key={b}>
                <span className={styles[`b${b}`]} aria-hidden="true" />
                {fmt(lim[b])} a {fmt(lim[b + 1])}
              </li>
            ))}
          </ul>
        </div>

        <LayoutGroup id={`lista-${m.id}`}>
          <ol className={styles.lista} aria-label={`Estados em ordem, ${periodo(ref)}`}>
            {ordem.map(({ uf, v }, pos) => (
              <motion.li
                key={uf}
                layout={reduz ? false : "position"}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                data-foco={foco === uf || undefined}
                onPointerEnter={() => setFoco(uf)}
              >
                <span className={styles.pos}>{pos + 1}</span>
                <span className={styles.nome}>{m.nomes[uf]}</span>
                <span className={styles.barra} aria-hidden="true">
                  <span className={styles[`b${faixa(v, lim)}`]} style={{ width: `${(v / max) * 100}%` }} />
                </span>
                <span className={styles.valor}>{fmt(v)}</span>
              </motion.li>
            ))}
          </ol>
        </LayoutGroup>
      </div>

      <p className={ui.sourceLine}>
        Fonte:{" "}
        <a href={m.fonte.url} rel="noopener">
          {m.fonte.orgao}
        </a>{" "}
        ({periodo(m.periodos.at(-1)!)}). Número do Brasil: <Link href={`/indicador/${m.indicador}`}>página do indicador</Link>.
      </p>
    </div>
  );
}
