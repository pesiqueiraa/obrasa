// Contas das ferramentas, feitas no navegador com números lidos do banco. Funções puras,
// testadas em contas.test.ts.

import { formatNumber } from "./format";

export type Ponto = [string, number];

/** "2.000,50" ou "2000.5" → 2000.5. */
export function leValor(s: string): number | null {
  const limpo = s.replace(/[^\d,.]/g, "");
  if (!limpo) return null;
  const n = limpo.includes(",") ? Number(limpo.replace(/\./g, "").replace(",", ".")) : Number(limpo.replace(/\.(?=\d{3}(\D|$))/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Último ponto publicado até o fim do mês AAAA-MM. */
export function noMes(pontos: Ponto[], mes: string): Ponto | null {
  let achado: Ponto | null = null;
  for (const p of pontos) {
    if (p[0].slice(0, 7) > mes) break;
    achado = p;
  }
  return achado;
}

export function diferenca(s: { tipo: "taxa" | "nivel"; unidade: string; casas: number }, a: number, b: number) {
  const seta = b > a ? "↑" : b < a ? "↓" : "=";
  if (s.tipo === "taxa") {
    const unidade = s.unidade.startsWith("%") ? " p.p." : ` ${s.unidade}`;
    return { seta, texto: `${formatNumber(Math.abs(b - a), s.casas)}${unidade}` };
  }
  if (a === 0) return { seta, texto: "sem base para comparar" };
  return { seta, texto: `${formatNumber(Math.abs((b / a - 1) * 100), 1)}%` };
}

/** 6 limites de 5 faixas iguais entre o menor e o maior valor, arredondados às casas do dado. */
export function limites(valores: number[], casas: number): number[] {
  const f = 10 ** casas;
  const lo = Math.floor(Math.min(...valores) * f) / f;
  const hi = Math.ceil(Math.max(...valores) * f) / f;
  return Array.from({ length: 6 }, (_, i) => Math.round((lo + ((hi - lo) * i) / 5) * f) / f);
}
