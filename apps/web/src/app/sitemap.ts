// /sitemap.xml: páginas fixas, temas (config/temas.yaml), cada indicador com a página de
// metodologia e cada mandato da aba Governos, a partir do banco.

import type { MetadataRoute } from "next";
import { getTemas, listIndicatorSlugs } from "@/lib/data";
import { getMandatos } from "@/lib/governos";

const FIXAS = [
  "/",
  "/metodologia",
  "/calculadora",
  "/comparar",
  "/agenda",
  "/correcoes",
  "/reportar-erro",
  "/privacidade",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const [temas, slugs, mandatos] = await Promise.all([getTemas(), listIndicatorSlugs(), getMandatos()]);
  const caminhos = [
    ...FIXAS,
    ...temas.map((t) => `/${t.slug}`),
    ...slugs.flatMap((s) => [`/indicador/${s}`, `/metodologia/${s}`]),
    ...mandatos.map((m) => `/governos/${m.slug}`),
  ];
  return [...new Set(caminhos)].map((c) => ({ url: `${site}${c === "/" ? "" : c}` }));
}
