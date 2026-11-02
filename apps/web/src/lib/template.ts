// Frases "o que significa para você": vêm de templates versionados em
// config/templates (docs/04, F1). Nunca de IA.

import { addMonths, formatNumber, formatRefLong, formatValue, monthLong, type FrequenciaRef } from "./format";

export type Template = Record<string, string>;

/** Lê o formato de config/templates: comentários com "#", seções "[nome]". */
export function parseTemplate(text: string): Template {
  const out: Template = {};
  let current: string | null = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const section = /^\[([a-z_]+)\]$/.exec(line);
    if (section) {
      current = section[1];
      out[current] = "";
      continue;
    }
    if (!current) throw new Error(`linha fora de seção no template: ${line}`);
    out[current] = out[current] ? `${out[current]} ${line}` : line;
  }
  return out;
}

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-z_]+)\}/g, (_, name: string) => {
    if (!(name in vars)) throw new Error(`variável sem valor no template: ${name}`);
    return vars[name];
  });
}

/** O que a frase precisa saber do indicador. Tudo vem do banco. */
export type FraseCtx = {
  refDate: string;
  value: number;
  unidade: string;
  casas: number;
  frequencia: FrequenciaRef;
  /** Série exibida, em ordem de data (usada por regras como a da Selic). */
  obs?: { refDate: string; value: number }[];
};

type Frase = (template: Template, ctx: FraseCtx) => string;

/** Regras especiais por template. Os demais usam `fraseGenerica`. */
export const FRASES: Record<string, Frase> = {
  "ipca_12m.pt.txt": (t, c) => fraseAcumulado12m(t, c.refDate, c.value),
  "selic.pt.txt": (t, c) => fraseGenerica(t, c, { desde: formatRefLong(inicioDoValorVigente(c), "diaria") }),
};

export function frase(arquivo: string, template: Template, ctx: FraseCtx): string {
  return (FRASES[arquivo] ?? fraseGenerica)(template, ctx);
}

/**
 * Seção [padrao] quando existe; senão [sobe], [cai] ou [estavel] pelo sinal do valor
 * arredondado. Variáveis: {x} (com unidade; sem sinal nas variantes), {x_num}, {periodo}.
 */
export function fraseGenerica(template: Template, ctx: FraseCtx, extra: Record<string, string> = {}): string {
  const rounded = Number(ctx.value.toFixed(ctx.casas));
  let text = template.padrao;
  let shown = rounded;
  if (!text) {
    const variante = rounded > 0 ? "sobe" : rounded < 0 ? "cai" : "estavel";
    text = template[variante];
    if (!text) throw new Error(`template sem [padrao] nem a variante [${variante}]`);
    shown = Math.abs(rounded);
  }
  return fill(text, {
    x: formatValue(shown, ctx.unidade, ctx.casas),
    x_num: formatNumber(shown, ctx.casas),
    periodo: formatRefLong(ctx.refDate, ctx.frequencia),
    ...extra,
  });
}

/** Primeiro dia, sem interrupção até o último, em que a série tem o valor atual. */
export function inicioDoValorVigente(ctx: FraseCtx): string {
  const obs = ctx.obs ?? [];
  if (obs.length === 0) return ctx.refDate;
  const atual = obs[obs.length - 1].value;
  let i = obs.length - 1;
  while (i > 0 && obs[i - 1].value === atual) i--;
  return obs[i].refDate;
}

/** Frase do IPCA em 12 meses a partir do valor do banco. */
export function fraseAcumulado12m(template: Template, refDate: string, value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const variante = rounded > 0 ? "sobe" : rounded < 0 ? "cai" : "estavel";
  const text = template[variante];
  if (!text) throw new Error(`template sem a variante [${variante}]`);
  return fill(text, {
    x: formatNumber(Math.abs(rounded)),
    mes_ref: monthLong(refDate),
    mes_base: monthLong(addMonths(refDate, -12)),
    valor_corrigido: formatNumber(100 * (1 + rounded / 100)),
  });
}
