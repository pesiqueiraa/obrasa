// Frases "o que significa para você": vêm de templates versionados em
// config/templates (docs/04, F1). Nunca de IA.

import { formatNumber, monthLong, addMonths } from "./format";

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

type Frase = (template: Template, refDate: string, value: number) => string;

/** Como cada template versionado é preenchido. A chave é indicators.frase_template. */
export const FRASES: Record<string, Frase> = {
  "ipca_12m.pt.txt": (t, r, v) => fraseAcumulado12m(t, r, v),
};

export function frase(arquivo: string, template: Template, refDate: string, value: number): string {
  const fn = FRASES[arquivo];
  if (!fn) throw new Error(`template sem regra de preenchimento: ${arquivo}`);
  return fn(template, refDate, value);
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
