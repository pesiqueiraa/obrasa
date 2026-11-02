"use client";

// Leitura do gráfico de linha do painel (ChartPanel): mouse ou dedo sobre o gráfico mostra
// um fio, um ponto e a etiqueta com o período e o valor do ponto mais próximo; arrastar o
// dedo para os lados percorre a série (useLeitura). Substitui a dica do Carbon, que no
// celular só abria com um toque e não acompanhava o dedo.
// As posições vêm do próprio desenho do Carbon (o caminho `path.line`): o k-ésimo ponto
// desenhado é o k-ésimo valor da série. Se as contagens não baterem, não mostra nada.

import type { ReactNode } from "react";
import { useLeitura } from "./useLeitura";
import styles from "./viz.module.scss";

type Foco = { i: number; x: number; y: number; topo: number; base: number; largura: number };

const NUM = String.raw`-?\d+(?:\.\d+)?(?:e-?\d+)?`;
const PONTO = new RegExp(String.raw`[ML]\s*(${NUM})[ ,]\s*(${NUM})`, "g");

export function LeituraLinha({ rotulos, children }: { rotulos: string[]; children: ReactNode }) {
  const { foco, props } = useLeitura<Foco, HTMLDivElement>(({ clientX, alvo }) => {
    const linha = alvo.querySelector<SVGPathElement>("path.line");
    const m = linha?.getScreenCTM();
    if (!linha || !m) return null;
    const pts = [...(linha.getAttribute("d") ?? "").matchAll(PONTO)].map(([, x, y]) =>
      new DOMPoint(Number(x), Number(y)).matrixTransform(m),
    );
    if (pts.length !== rotulos.length || pts.length === 0) return null;
    let i = 0;
    pts.forEach((p, k) => {
      if (Math.abs(p.x - clientX) < Math.abs(pts[i].x - clientX)) i = k;
    });
    const caixa = alvo.getBoundingClientRect();
    const fundo = alvo.querySelector("rect.chart-grid-backdrop")?.getBoundingClientRect();
    return {
      i,
      x: pts[i].x - caixa.left,
      y: pts[i].y - caixa.top,
      topo: (fundo?.top ?? caixa.top) - caixa.top,
      base: (fundo?.bottom ?? caixa.bottom) - caixa.top,
      largura: caixa.width,
    };
  });

  return (
    <div className={styles.leitura} {...props}>
      {children}
      {foco ? (
        <div aria-hidden="true">
          <span className={styles.leituraFio} style={{ left: foco.x, top: foco.topo, height: foco.base - foco.topo }} />
          <span className={styles.leituraPonto} style={{ left: foco.x, top: foco.y }} />
          <span
            className={styles.leituraEtiqueta}
            data-esq={foco.x > foco.largura / 2 || undefined}
            style={{ left: foco.x, top: Math.max(0, foco.topo - 30) }}
          >
            {rotulos[foco.i]}
          </span>
        </div>
      ) : null}
    </div>
  );
}
