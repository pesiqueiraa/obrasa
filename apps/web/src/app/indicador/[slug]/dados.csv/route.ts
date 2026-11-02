// "Baixar CSV": série completa exibida no indicador, com cabeçalho de fonte,
// série, unidade e data de coleta (docs/04, F0).

import { buildCsv } from "@/lib/csv";
import { getIndicatorView, listIndicatorSlugs } from "@/lib/data";

export async function generateStaticParams() {
  const slugs = await listIndicatorSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function GET(_request: Request, ctx: RouteContext<"/indicador/[slug]/dados.csv">) {
  const { slug } = await ctx.params;
  const view = await getIndicatorView(slug);
  if (!view) return new Response("Indicador não encontrado", { status: 404 });
  const { indicator, exibida } = view;
  const csv = buildCsv(
    {
      titulo: indicator.titulo,
      orgao: exibida.source.orgao,
      fonteNome: exibida.source.nome,
      urlFonte: exibida.source.url_fonte,
      seriesId: exibida.series.id,
      codigoExterno: exibida.series.codigo_externo,
      serieNome: exibida.series.nome,
      unidade: exibida.series.unidade,
      urlPagina: `/indicador/${indicator.slug}`,
    },
    exibida.obs,
  );
  const latest = exibida.obs.at(-1)?.refDate.slice(0, 7) ?? "";
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${indicator.slug}_${latest}.csv"`,
    },
  });
}
