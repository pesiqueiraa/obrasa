// Ponte para a API do IBGE (servicodados.ibge.gov.br), usada pela coleta no GitHub Actions.
//
// O IBGE recusa conexões de fora do Brasil nessa API, e as máquinas do GitHub ficam nos
// EUA (diagnóstico de 02/11/2026, docs/06). A função roda na Vercel em São Paulo
// (vercel.json, região gru1) e repassa o pedido sem mudar nada: mesma URL de origem,
// mesmo corpo, byte a byte. A coleta guarda a URL do IBGE, não a da ponte.
//
// Fechada por padrão: sem a variável PONTE_IBGE_TOKEN (32+ caracteres) responde 404.
// Só aceita GET, só para o IBGE, só com o token no cabeçalho x-ponte-token.

import { timingSafeEqual } from "node:crypto";

export const ORIGEM_IBGE = "https://servicodados.ibge.gov.br/api/";
const SEGMENTO = /^[A-Za-z0-9._|-]+$/;
const TOKEN_MINIMO = 32;

export function tokenConfere(recebido: string | null, esperado: string | undefined): boolean {
  if (!esperado || esperado.length < TOKEN_MINIMO || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** URL do IBGE para os segmentos e a query recebidos, ou null se o caminho não for aceito. */
export function urlDoIbge(caminho: string[], query: string): URL | null {
  if (caminho.length === 0 || caminho.length > 12) return null;
  if (caminho.some((s) => s === "." || s === ".." || !SEGMENTO.test(s))) return null;
  const url = new URL(ORIGEM_IBGE + caminho.join("/"));
  if (!url.href.startsWith(ORIGEM_IBGE)) return null;
  url.search = query;
  return url;
}
