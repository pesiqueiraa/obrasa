// Aba Governos, bloco 1 (docs/10, 3.7.1): o último dado antes da posse e o último dado do
// mandato. Contas puras sobre valores do banco, sem estimar nada.
//
// Regra única (metodologia): vale o último período que TERMINOU antes do dia da posse, e o
// último que terminou até o último dia do mandato (ou até ontem, no mandato em curso). O fim
// do período depende da frequência: dia (diária), último dia do mês (mensal e trimestre
// móvel, que a fonte data pelo último mês), último dia do trimestre (trimestral) e 31/12
// (anual). Ponto mais distante que DEFASAGEM_MAX_DIAS da data conta como "sem dado": a
// série começou depois ou tem buraco, e o oBrasa não troca de pesquisa para preencher.

import { addDays, parseDay, type FrequenciaRef } from "./format";

export const DEFASAGEM_MAX_DIAS = 100;

export type Ponto = { refDate: string; value: number };

function ultimoDiaDoMes(y: number, m: number): string {
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Último dia do período de referência `ref` (AAAA-MM-DD). */
export function fimDoPeriodo(ref: string, freq: FrequenciaRef): string {
  const [y, m] = parseDay(ref);
  switch (freq) {
    case "diaria":
    case "evento":
      return ref;
    case "trimestral":
      return ultimoDiaDoMes(y, Math.ceil(m / 3) * 3);
    case "anual":
      return `${y}-12-31`;
    default: // mensal e trimestral_movel
      return ultimoDiaDoMes(y, m);
  }
}

function dias(a: string, b: string): number {
  return (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
}

/**
 * Último ponto cujo período termina até `limite` (inclusive). Com `defasagem`, o ponto mais
 * antigo que isso conta como sem dado.
 */
export function ultimoAte<T extends Ponto>(
  obs: T[],
  freq: FrequenciaRef,
  limite: string,
  defasagem: number | null = DEFASAGEM_MAX_DIAS,
): T | null {
  let achado: T | null = null;
  for (const o of obs) {
    if (fimDoPeriodo(o.refDate, freq) <= limite) achado = o;
  }
  if (!achado) return null;
  return defasagem === null || dias(fimDoPeriodo(achado.refDate, freq), limite) <= defasagem ? achado : null;
}

export type PosseEFim<T extends Ponto> = { posse: T | null; fim: T | null };

/**
 * Pontos de posse e de fim. `fim` null: mandato em curso, vale o último período que terminou
 * até ontem (`hoje` − 1 dia), sem limite de defasagem (a fonte ainda vai divulgar os
 * períodos seguintes; a tela mostra a data do ponto). O ponto de fim precisa terminar
 * depois da posse.
 */
export function posseEFim<T extends Ponto>(
  obs: T[],
  freq: FrequenciaRef,
  inicio: string,
  fim: string | null,
  hoje: string,
): PosseEFim<T> {
  const posse = ultimoAte(obs, freq, addDays(inicio, -1));
  const final = fim ? ultimoAte(obs, freq, fim) : ultimoAte(obs, freq, addDays(hoje, -1), null);
  return { posse, fim: final && fimDoPeriodo(final.refDate, freq) >= inicio ? final : null };
}

/** Variação entre os dois pontos: pontos percentuais em taxa, % em nível. */
export function variacao(tipo: "taxa" | "nivel", de: number, para: number): { valor: number; unidade: "p.p." | "%" } {
  if (tipo === "taxa") return { valor: para - de, unidade: "p.p." };
  return { valor: (para / de - 1) * 100, unidade: "%" };
}

/**
 * Anos do calendário de um mandato, para as metas anuais: o ano fica com o mandato em
 * exercício em 31/12. No mandato em curso entra também o ano corrente, ainda sem dezembro.
 */
export function anosDoMandato(inicio: string, fim: string | null, hoje: string): number[] {
  const [y0] = parseDay(inicio);
  const [y1] = parseDay(fim ?? hoje);
  const anos: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const dezembro = `${y}-12-31`;
    if (dezembro >= inicio && (fim === null || dezembro <= fim)) anos.push(y);
  }
  return anos;
}
