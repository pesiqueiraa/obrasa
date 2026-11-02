// /sitemap.xml: páginas fixas, temas (config/temas.yaml) e cada indicador com a página de
// metodologia, a partir do banco.

import type { MetadataRoute } from "next";
import { getTemas, listIndicatorSlugs } from "@/lib/data";

const FIXAS = [
  "/",
  "/metodologia",
  "/calculadora",
  "/comparar",
  "/agenda",
  "/correcoes",
  "/quem-financia",
  "/reportar-erro",
  "/privacidade",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const [temas, slugs] = await Promise.all([getTemas(), listIndicatorSlugs()]);
  const caminhos = [
    ...FIXAS,
    ...temas.map((t) => `/${t.slug}`),
    ...slugs.flatMap((s) => [`/indicador/${s}`, `/metodologia/${s}`]),
  ];
  return [...new Set(caminhos)].map((c) => ({ url: `${site}${c === "/" ? "" : c}` }));
}
