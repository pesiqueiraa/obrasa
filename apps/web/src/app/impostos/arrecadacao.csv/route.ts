// "Baixar CSV" da arrecadação federal: a série nominal como está no banco, com o
// cabeçalho de fonte. O valor real da tela é calculado a partir desta série e do IPCA.

import { buildCsv } from "@/lib/csv";
import { seriesUrl } from "@/lib/data";
import { getArrecadacao } from "@/lib/impostos";

export async function GET() {
  const a = await getArrecadacao();
  if (!a) return new Response("Arrecadação ainda não coletada", { status: 404 });
  const { total } = a;
  const csv = buildCsv(
    {
      titulo: "Arrecadação federal por mês",
      orgao: total.source.orgao,
      fonteNome: total.source.nome,
      urlFonte: seriesUrl(total.source, total.series),
      seriesId: total.series.id,
      codigoExterno: total.series.codigo_externo,
      serieNome: total.series.nome,
      unidade: total.series.unidade,
      urlPagina: "/impostos",
      nota: "Valores nominais. O valor real da página é este valor corrigido pelo IPCA (IBGE, número-índice).",
    },
    total.obs,
  );
  const latest = total.obs.at(-1)?.refDate.slice(0, 7) ?? "";
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arrecadacao-federal_${latest}.csv"`,
    },
  });
}
