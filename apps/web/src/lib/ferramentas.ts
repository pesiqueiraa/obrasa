// Dados das ferramentas (calculadora de inflação e comparador de datas). Só leitura do
// banco, como no resto do site; as contas são feitas no navegador com esses números.

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getIndicatorView, getSeriesBundle, getTemas, listIndicatorSlugs, seriesUrl } from "./data";
import { lastOfMonth } from "./indicator";

/** Primeiro mês do real (Plano Real, jul/1994): antes disso a moeda era outra. */
export const INICIO_REAL = "1994-07-01";
export const SERIE_INDICE_IPCA = "ibge_agregados_1737_2266";

export type Fonte = { orgao: string; url: string | null; ref: string; frequencia: string };

export type IndiceIpca = {
  /** [AAAA-MM, número-índice], de jul/1994 até o último mês publicado. */
  pontos: [string, number][];
  fonte: Fonte;
};

export async function getIndiceIpca(): Promise<IndiceIpca> {
  "use cache";
  cacheLife("hours");
  cacheTag("indicadores");
  const b = await getSeriesBundle(SERIE_INDICE_IPCA);
  const pontos = b.obs
    .filter((o) => o.refDate >= INICIO_REAL)
    .map((o) => [o.refDate.slice(0, 7), o.value] as [string, number]);
  const ultimo = b.obs.at(-1);
  if (!ultimo) throw new Error("número-índice do IPCA sem observações");
  return {
    pontos,
    fonte: { orgao: b.source.orgao, url: seriesUrl(b.source, b.series), ref: ultimo.refDate, frequencia: "mensal" },
  };
}

export type SerieComparavel = {
  slug: string;
  titulo: string;
  tema: string;
  temaTitulo: string;
  unidade: string;
  casas: number;
  tipo: "nivel" | "taxa";
  frequencia: string;
  fonte: Fonte;
  /** Série monetária: valor real, a preços do último período (regra 3). */
  baseReal: string | null;
  /** [AAAA-MM-DD, valor]; série diária reduzida ao último valor de cada mês. */
  pontos: [string, number][];
  nominal: [string, number][] | null;
};

export async function getComparaveis(): Promise<SerieComparavel[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("indicadores");
  const [slugs, temas] = await Promise.all([listIndicatorSlugs(), getTemas()]);
  const titulos = new Map(temas.map((t) => [t.slug, t.titulo]));
  const ordemTema = new Map(temas.map((t) => [t.slug, t.ordem]));
  const views = (await Promise.all(slugs.map((s) => getIndicatorView(s)))).filter((v) => v !== null);
  const reduz = (obs: { refDate: string; value: number }[], freq: string) =>
    (freq === "diaria" ? lastOfMonth(obs) : obs).map((o) => [o.refDate, o.value] as [string, number]);
  return views
    .map((v) => {
      const { indicator, exibida, nominal } = v;
      const ultimo = exibida.obs.at(-1);
      if (!ultimo) throw new Error(`indicador ${indicator.slug} sem observações`);
      return {
        slug: indicator.slug,
        titulo: indicator.titulo,
        tema: indicator.tema,
        temaTitulo: titulos.get(indicator.tema) ?? indicator.tema,
        unidade: exibida.series.unidade,
        casas: indicator.casas_decimais,
        tipo: exibida.series.tipo,
        frequencia: exibida.series.frequencia,
        fonte: {
          orgao: exibida.source.orgao,
          url: seriesUrl(exibida.source, exibida.series),
          ref: ultimo.refDate,
          frequencia: exibida.series.frequencia,
        },
        baseReal: exibida.series.monetaria ? ultimo.refDate : null,
        pontos: reduz(exibida.obs, exibida.series.frequencia),
        nominal: nominal ? reduz(nominal.obs, nominal.series.frequencia) : null,
      };
    })
    .sort((a, b) => (ordemTema.get(a.tema) ?? 99) - (ordemTema.get(b.tema) ?? 99));
}
