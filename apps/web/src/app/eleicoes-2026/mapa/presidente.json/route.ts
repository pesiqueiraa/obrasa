// Votos para presidente por município e turno (TSE), no formato compacto de
// getMapaPresidente. Lido pelo mapa no cliente.

import { getMapaPresidente } from "@/lib/eleicoes";

export async function GET() {
  return Response.json(await getMapaPresidente());
}
