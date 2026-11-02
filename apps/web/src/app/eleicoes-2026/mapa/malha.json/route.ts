// Malhas do IBGE (municípios e UFs, TopoJSON) para o mapa da página de eleições.
// Servidas daqui, e não embutidas no HTML, para a página carregar antes do mapa.

import { getMalha } from "@/lib/eleicoes";

export async function GET() {
  const [municipios, ufs] = await Promise.all([getMalha("br_municipios"), getMalha("br_ufs")]);
  return Response.json({ municipios: municipios.topo, ufs: ufs.topo, url: municipios.url });
}
