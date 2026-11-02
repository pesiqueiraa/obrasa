// Formatação comum da página de eleições. Sem "server-only": usada também no mapa (cliente).

import { formatNumber } from "@/lib/format";

/** Percentual com 2 casas, como o TSE divulga: "51,79%". */
export function pct(parte: number, todo: number): string {
  return todo > 0 ? `${formatNumber((parte / todo) * 100, 2)}%` : "–";
}

export function inteiro(n: number): string {
  return formatNumber(n, 0);
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Nome de urna do TSE (em caixa alta) em caixa normal: "ESCRITOR AUGUSTO CURY" →
 *  "Escritor Augusto Cury". Só a caixa muda; as letras são as do TSE. */
export function nomeProprio(nome: string): string {
  return nome
    .toLocaleLowerCase("pt-BR")
    .split(/(\s+|-)/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join("");
}

export const UF_NOME: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AM: "Amazonas",
  AP: "Amapá",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MG: "Minas Gerais",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  PR: "Paraná",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RO: "Rondônia",
  RR: "Roraima",
  RS: "Rio Grande do Sul",
  SC: "Santa Catarina",
  SE: "Sergipe",
  SP: "São Paulo",
  TO: "Tocantins",
  ZZ: "Exterior",
};
