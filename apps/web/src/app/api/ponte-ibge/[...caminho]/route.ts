// Ponte para a API do IBGE: regras e motivo em lib/ponte.ts.

import { tokenConfere, urlDoIbge } from "@/lib/ponte";

export const maxDuration = 60;

const nada = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request, ctx: { params: Promise<{ caminho: string[] }> }) {
  if (!tokenConfere(request.headers.get("x-ponte-token"), process.env.PONTE_IBGE_TOKEN)) return nada(404);
  const { caminho } = await ctx.params;
  const url = urlDoIbge(caminho, new URL(request.url).search);
  if (!url) return nada(400);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      cache: "no-store",
      redirect: "manual", // nunca seguir para fora do IBGE
      headers: { "user-agent": request.headers.get("user-agent") ?? "oBrasa" },
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    return nada(504);
  }
  return new Response(resposta.body, {
    status: resposta.status,
    headers: {
      "content-type": resposta.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
