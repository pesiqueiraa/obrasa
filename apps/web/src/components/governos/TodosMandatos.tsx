"use client";

// Um indicador ao longo de todos os mandatos (/governos; DESIGN.md, `chart-panel` e
// `mandate-band`). Os mesmos 7 indicadores das páginas de mandato, escolhidos por botões. Uma
// faixa por mandato, alternando `chart-band` e canvas, todas com o mesmo destaque, com retrato
// e anos no topo (link para o mandato). Uma linha em `chart-1`, mesma cor em todas as faixas;
// sem média por governo, ranking ou cor de partido (docs/02). Série monetária abre no valor
// real, com seletor Real/Nominal e o mês-base escrito (regra 3). A linha se desenha ao trocar
// de indicador; mouse ou dedo mostram período, valor e mandato. "Ver tabela" e "Baixar CSV"
// dão os mesmos números em texto. O SVG é desenhado na largura medida, para o traço não
// esticar.

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ui from "@/components/ui.module.scss";
import { useLeitura } from "@/components/viz/useLeitura";
import { formatNumber, formatRef, formatValue, type FrequenciaRef } from "@/lib/format";
import type { BlocoTodosMandatos, SerieTodosMandatos } from "@/lib/governos";
import type { Ponto } from "@/lib/mandato";
import styles from "./governos.module.scss";

const H = 280;
const PAD_TOPO = 56; // espaço das fotos das faixas
const PAD_BASE = 12;
const PAD_DIR = 8; // o ponto do último valor não encosta na borda
const DIA = 86_400_000;
const PASSO: Record<FrequenciaRef, number> = {
  diaria: 31,
  mensal: 31,
  trimestral_movel: 31,
  trimestral: 92,
  anual: 366,
  evento: 366,
};

const ms = (d: string) => Date.parse(`${d.slice(0, 10)}T12:00:00Z`);

function marcas(min: number, max: number): number[] {
  const bruto = (max - min) / 4 || 1;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => p >= bruto) ?? bruto;
  const out: number[] = [];
  for (let v = Math.floor(min / passo) * passo; v <= max + passo * 1e-9; v += passo) out.push(Number(v.toFixed(10)));
  if (out.at(-1)! < max) out.push(Number((out.at(-1)! + passo).toFixed(10)));
  return out;
}

/** Trechos contínuos: período que a fonte não publicou interrompe a linha (DESIGN.md, sparkline). */
function trechos(pts: Ponto[], freq: FrequenciaRef): Ponto[][] {
  const out: Ponto[][] = [];
  for (const p of pts) {
    const ult = out.at(-1)?.at(-1);
    if (!ult || ms(p.refDate) - ms(ult.refDate) > PASSO[freq] * 2.5 * DIA) out.push([p]);
    else out.at(-1)!.push(p);
  }
  return out;
}

function csv(s: SerieTodosMandatos, base: string): string {
  const cab = s.nominais ? `periodo;valor_real_a_precos_de_${base.slice(0, 7)};valor_nominal` : "periodo;valor";
  const nom = new Map(s.nominais?.map((p) => [p.refDate, p.value]));
  const linhas = s.pontos.map((p) =>
    [p.refDate, String(p.value), ...(s.nominais ? [String(nom.get(p.refDate) ?? "")] : [])].join(";"),
  );
  return [`# ${s.titulo} (${s.unidade}). Fonte: ${s.fonte.orgao} ${s.fonte.url ?? ""}`, cab, ...linhas].join("\n");
}

export function TodosMandatos({ bloco }: { bloco: BlocoTodosMandatos }) {
  const { mandatos, series, base } = bloco;
  const [id, setId] = useState(series[0]?.id);
  const [nominal, setNominal] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = series.find((x) => x.id === id) ?? series[0];
  const pts = s && nominal && s.nominais ? s.nominais : (s?.pontos ?? []);
  const t0 = Math.min(...series.map((x) => ms(x.pontos[0].refDate)));
  const t1 = Math.max(...series.map((x) => ms(x.pontos.at(-1)!.refDate)));
  const fx = (t: number) => ((t - t0) / (t1 - t0)) * (w - PAD_DIR);

  const { foco, props: leitura } = useLeitura<number, HTMLDivElement>(({ clientX, alvo }) => {
    if (!pts.length) return null;
    const box = alvo.getBoundingClientRect();
    const t = t0 + ((clientX - box.left) / (box.width - PAD_DIR)) * (t1 - t0);
    let melhor = 0;
    pts.forEach((p, i) => {
      if (Math.abs(ms(p.refDate) - t) < Math.abs(ms(pts[melhor].refDate) - t)) melhor = i;
    });
    return melhor;
  });

  if (!s) return null;
  const valores = pts.map((p) => p.value);
  const temNegativo = valores.some((v) => v < 0);
  const ticks = marcas(Math.min(...valores, ...(temNegativo ? [0] : [])), Math.max(...valores));
  const lo = ticks[0];
  const hi = ticks.at(-1)!;
  const fy = (v: number) => PAD_TOPO + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD_TOPO - PAD_BASE);
  const casasEixo = Math.max(0, -Math.floor(Math.log10(Math.abs(ticks[1] - ticks[0]) || 1)));
  const fmt = (v: number) => formatValue(v, s.unidade, s.casas);
  const freqRotulo: FrequenciaRef = s.freq === "diaria" ? "mensal" : s.freq;
  const desenho = trechos(pts, s.freq)
    .map((tr) => tr.map((p, i) => `${i ? "L" : "M"}${fx(ms(p.refDate)).toFixed(1)},${fy(p.value).toFixed(1)}`).join(""))
    .join("");
  const ultimo = pts.at(-1)!;
  const mandatoDe = (d: string) => mandatos.findLast((m) => m.inicio <= d) ?? null;
  const pf = foco !== null && foco < pts.length ? pts[foco] : null;
  const real = s.nominais !== null && !nominal;

  // Tabela: o último período publicado de cada ano.
  const porAno = new Map<string, Ponto>();
  for (const p of pts) porAno.set(p.refDate.slice(0, 4), p);

  const baixar = () => {
    const url = URL.createObjectURL(new Blob([csv(s, base)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `obrasa-governos-${s.id}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.todos}>
      <div className={styles.todosEscolha} role="group" aria-label="Escolher indicador">
        {series.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === s.id}
            className={styles.todosBotao}
            onClick={() => setId(x.id)}
          >
            {x.titulo}
          </button>
        ))}
      </div>
      <div className={styles.todosSub}>
        <p>
          Em {s.unidade}
          {real ? `, a preços de ${formatRef(base)}` : null}
          {s.nominais && nominal ? ", valor nominal" : null}
        </p>
        {s.nominais ? (
          <div className={styles.todosModo} role="group" aria-label="Valor real ou nominal">
            <button type="button" aria-pressed={!nominal} onClick={() => setNominal(false)}>
              Real
            </button>
            <button type="button" aria-pressed={nominal} onClick={() => setNominal(true)}>
              Nominal
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.todosArea}>
        <div className={styles.todosEixoY} aria-hidden="true" style={{ height: H }}>
          {ticks.map((v) => (
            <span key={v} style={{ top: fy(v) }}>
              {formatNumber(v, casasEixo)}
            </span>
          ))}
        </div>
        <div ref={caixa} className={styles.todosGrafico} style={{ height: H }}>
          {w > 0
            ? mandatos.map((m, i) => {
                const a = Math.max(t0, ms(m.inicio));
                const b = m.fim ? ms(m.fim) : t1;
                const ultima = i === mandatos.length - 1;
                const anos = `${m.inicio.slice(0, 4)}–${m.fim ? m.fim.slice(0, 4) : "hoje"}`;
                return (
                  <div
                    key={m.slug}
                    className={styles.todosFaixa}
                    data-par={i % 2 === 0 ? "" : undefined}
                    style={{ left: fx(a), width: Math.max(0, (ultima ? w : fx(b)) - fx(a)) }}
                  >
                    <Link href={`/governos/${m.slug}`} className={styles.todosRotulo} aria-label={`${m.rotulo}, ${anos}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- retrato carregado do Commons */}
                      <img src={m.foto} alt="" width={30} height={30} loading="lazy" />
                      <span>{anos}</span>
                    </Link>
                  </div>
                );
              })
            : null}
          {ticks.map((v) => (
            <span
              key={v}
              className={styles.todosGrade}
              data-zero={v === 0 && temNegativo ? "" : undefined}
              style={{ top: fy(v) }}
            />
          ))}
          {w > 0 ? (
            <svg className={styles.todosSvg} width={w} height={H} aria-hidden="true" focusable="false">
              <motion.path
                key={`${s.id}-${nominal}`}
                d={desenho}
                fill="none"
                stroke="var(--bd-color-chart-1)"
                strokeWidth={2}
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              />
              <circle cx={fx(ms(ultimo.refDate))} cy={fy(ultimo.value)} r={4} fill="var(--bd-color-chart-1)" />
              {pf ? (
                <>
                  <line
                    x1={fx(ms(pf.refDate))}
                    x2={fx(ms(pf.refDate))}
                    y1={PAD_TOPO - 6}
                    y2={H}
                    stroke="var(--bd-color-ink)"
                    strokeWidth={1}
                  />
                  <circle
                    cx={fx(ms(pf.refDate))}
                    cy={fy(pf.value)}
                    r={5}
                    fill="var(--bd-color-canvas)"
                    stroke="var(--bd-color-ink)"
                    strokeWidth={2}
                  />
                </>
              ) : null}
            </svg>
          ) : null}
          <div className={styles.todosToque} aria-hidden="true" {...leitura} />
          {pf ? (
            <p
              className={styles.todosEtiqueta}
              aria-hidden="true"
              style={{ left: Math.min(Math.max(fx(ms(pf.refDate)), 80), w - 80) }}
            >
              {formatRef(pf.refDate, freqRotulo)}: {fmt(pf.value)}
              <span>{mandatoDe(pf.refDate)?.rotulo}</span>
            </p>
          ) : null}
        </div>
      </div>

      <p className={styles.aviso}>A mudança dentro de uma faixa não prova que o governo daquele período a causou.</p>
      <p className={ui.sourceLine}>
        Fonte: {s.fonte.url ? <a href={s.fonte.url} rel="noopener">{s.fonte.orgao}</a> : s.fonte.orgao} (
        {formatRef(s.fonte.ultimo, s.freq)})
        {real ? (
          <>
            . Corrigido pelo IPCA (
            {bloco.ipca.url ? <a href={bloco.ipca.url} rel="noopener">{bloco.ipca.orgao}</a> : bloco.ipca.orgao}) até{" "}
            {formatRef(base)}
          </>
        ) : null}
        {s.freq === "diaria" ? ". Último dia útil de cada mês" : null}
      </p>
      <div className={styles.todosAcoes}>
        <details>
          <summary>Ver tabela</summary>
          <table className={styles.todosTabela}>
            <caption>
              {s.titulo}: último período publicado de cada ano{real ? `, a preços de ${formatRef(base)}` : ""}
            </caption>
            <thead>
              <tr>
                <th scope="col">Período</th>
                <th scope="col">Valor</th>
                <th scope="col">Mandato</th>
              </tr>
            </thead>
            <tbody>
              {[...porAno.values()].map((p) => (
                <tr key={p.refDate}>
                  <td>{formatRef(p.refDate, freqRotulo)}</td>
                  <td>{fmt(p.value)}</td>
                  <td>{mandatoDe(p.refDate)?.rotulo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <button type="button" className={styles.verMais} onClick={baixar}>
          Baixar CSV
        </button>
      </div>
    </div>
  );
}
