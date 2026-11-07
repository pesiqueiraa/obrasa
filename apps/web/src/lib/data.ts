// Leitura do banco (Supabase) para as páginas. Todo número exibido sai daqui.
// Usa a chave anônima: as tabelas têm RLS só de leitura (supabase/migrations).

import "server-only";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { parse as parseYaml } from "yaml";
import { todayInBrazil } from "./format";
import {
  chooseSeries,
  delayStatus,
  nextRelease,
  type Atraso,
  type Frequencia,
  type Janela,
  type Obs,
  type Release,
} from "./indicator";
import { parseTemplate, type Template } from "./template";

const PAGE = 1000; // limite padrão de linhas por requisição do PostgREST

export function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Defina SUPABASE_URL e SUPABASE_ANON_KEY (veja apps/web/.env.example).");
  }
  // O cache é só o de "use cache" (cacheLife/cacheTag). Sem no-store, o Next guarda
  // as respostas do Supabase no fetch cache e uma revalidação poderia servir dado antigo.
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export function configDir(): string {
  return process.env.CONFIG_DIR ?? resolve(process.cwd(), "../../config");
}

export type Source = {
  id: string;
  nome: string;
  orgao: string;
  url_fonte: string | null;
  url_documentacao: string | null;
  url_metodologia: string | null;
  licenca: string | null;
};

export type Series = {
  id: string;
  source_id: string;
  codigo_externo: string;
  nome: string;
  unidade: string;
  frequencia: Frequencia;
  tipo: "nivel" | "taxa";
  monetaria: boolean;
  inicio: string | null;
  nota_metodologia: string | null;
  classificacao: string | null;
  // Prazo de divulgação sem calendário (config/sources.yaml, `prazo`).
  prazo_meses: number | null;
  prazo_dias: number | null;
};

export type Indicator = {
  slug: string;
  titulo: string;
  series_id: string;
  fallback_series_id: string | null;
  transformacao: string | null;
  verificacao: string | null;
  janela_padrao: Janela;
  frase_template: string;
  url_metodologia: string | null;
  tema: string;
  casas_decimais: number;
  serie_nominal: string | null;
  ordem: number | null;
  /** Nome do indicador no Focus do Banco Central, quando ele o cobre. */
  focus: string | null;
};

export type Tema = {
  slug: string;
  titulo: string;
  resumo: string;
  ordem: number;
  /** "propria": a página do tema tem rota própria (ex.: /eleicoes-2026). */
  pagina?: "indicadores" | "propria";
  /** "barra": link direto no cabeçalho; "temas" (padrão): dentro do painel Temas. */
  menu?: "barra" | "temas";
};

export type Correction = {
  id: number;
  data: string;
  descricao: string;
  antes: string | null;
  depois: string | null;
};

export type SeriesBundle = { series: Series; source: Source; obs: Obs[]; releases: Release[] };

export type IndicatorView = {
  indicator: Indicator;
  principal: SeriesBundle;
  reserva: SeriesBundle | null;
  /** Versão nominal de indicador monetário (regra 3). A principal é a real. */
  nominal: SeriesBundle | null;
  exibida: SeriesBundle;
  usandoReserva: boolean;
  proxima: Release | null;
  atualizadoEm: string | null; // data de divulgação do período exibido, ou da coleta
  atraso: Atraso;
  correcoesRecentes: Correction[];
  template: Template;
};

async function fetchObservations(db: SupabaseClient, seriesId: string): Promise<Obs[]> {
  const out: Obs[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("observations_current")
      .select("ref_date, value, revision, collected_at, raw_object")
      .eq("series_id", seriesId)
      .order("ref_date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`observations ${seriesId}: ${error.message}`);
    for (const r of data) {
      out.push({
        refDate: r.ref_date,
        value: Number(r.value),
        revision: r.revision,
        collectedAt: r.collected_at,
        rawObject: r.raw_object,
      });
    }
    if (data.length < PAGE) return out;
  }
}

async function fetchBundle(db: SupabaseClient, seriesId: string): Promise<SeriesBundle> {
  const { data: series, error } = await db.from("series").select("*").eq("id", seriesId).single<Series>();
  if (error || !series) throw new Error(`série ${seriesId} não encontrada: ${error?.message}`);
  const { data: source, error: e2 } = await db
    .from("sources")
    .select("*")
    .eq("id", series.source_id)
    .single<Source>();
  if (e2 || !source) throw new Error(`fonte ${series.source_id} não encontrada: ${e2?.message}`);
  const { data: rel, error: e3 } = await db
    .from("releases")
    .select("ref_date, divulgado_em, proxima_divulgacao")
    .eq("series_id", seriesId)
    .order("ref_date", { ascending: false })
    .limit(36);
  if (e3) throw new Error(`releases ${seriesId}: ${e3.message}`);
  const releases: Release[] = rel.map((r) => ({
    refDate: r.ref_date,
    divulgadoEm: r.divulgado_em,
    proximaDivulgacao: r.proxima_divulgacao,
  }));
  return { series, source, obs: await fetchObservations(db, seriesId), releases };
}

/** Série avulsa (sem indicador), para os blocos de tema que mostram uma distribuição. */
export async function getSeriesBundle(seriesId: string): Promise<SeriesBundle> {
  "use cache";
  cacheLife("hours");
  cacheTag("indicadores", `serie:${seriesId}`);
  return fetchBundle(client(), seriesId);
}

/** Temas do site, de config/temas.yaml (texto de navegação, não dado). */
export async function getTemas(): Promise<Tema[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("temas");
  const temas = parseYaml(await readFile(join(configDir(), "temas.yaml"), "utf8")) as Tema[];
  return [...temas].sort((a, b) => a.ordem - b.ordem);
}

/** Indicadores de um tema, na ordem do registro. */
export async function getTemaViews(tema: string): Promise<IndicatorView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("indicadores", `tema:${tema}`);
  const { data, error } = await client().from("indicators").select("slug").eq("tema", tema).order("ordem");
  if (error) throw new Error(`indicators do tema ${tema}: ${error.message}`);
  const views = await Promise.all(data.map((r) => getIndicatorView(r.slug)));
  return views.filter((v): v is IndicatorView => v !== null);
}

export async function listIndicatorSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("indicadores");
  const { data, error } = await client().from("indicators").select("slug").order("ordem");
  if (error) throw new Error(`indicators: ${error.message}`);
  return data.map((r) => r.slug);
}

/**
 * Transformação de exibição declarada em config/indicators.yaml. O banco guarda o valor
 * como a fonte publica; a troca acontece só aqui, e a metodologia diz qual foi.
 * inverter_sinal: NFSP (positivo = déficit) vira resultado (negativo = déficit), como no Focus.
 */
export function transforma(b: SeriesBundle, t: string | null): SeriesBundle {
  if (t === null) return b;
  if (t !== "inverter_sinal") throw new Error(`transformação desconhecida: ${t}`);
  return { ...b, obs: b.obs.map((o) => ({ ...o, value: o.value === 0 ? 0 : -o.value })) };
}

export async function getIndicatorView(slug: string): Promise<IndicatorView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`indicador:${slug}`);

  const db = client();
  const { data: indicator, error } = await db
    .from("indicators")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Indicator>();
  if (error) throw new Error(`indicador ${slug}: ${error.message}`);
  if (!indicator) return null;

  const principal = transforma(await fetchBundle(db, indicator.series_id), indicator.transformacao);
  const reserva = indicator.fallback_series_id
    ? transforma(await fetchBundle(db, indicator.fallback_series_id), indicator.transformacao)
    : null;
  const nominal = indicator.serie_nominal ? await fetchBundle(db, indicator.serie_nominal) : null;
  const { escolhida, usandoReserva } = chooseSeries(principal, reserva);
  const latest = escolhida.obs.at(-1);
  if (!latest) throw new Error(`indicador ${slug} sem observações no banco`);

  // A agenda de divulgação vem do órgão que produz o dado (fonte principal).
  const proxima = nextRelease(principal.releases, latest.refDate);
  const divulgacao = escolhida.releases.find((r) => r.refDate === latest.refDate)?.divulgadoEm ?? null;
  const atraso = delayStatus({
    latestRef: latest.refDate,
    frequencia: escolhida.series.frequencia,
    folga:
      escolhida.series.prazo_meses != null && escolhida.series.prazo_dias != null
        ? { meses: escolhida.series.prazo_meses, dias: escolhida.series.prazo_dias }
        : undefined,
    proxima,
    hoje: todayInBrazil(),
  });

  const limite = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: correcoes, error: e4 } = await db
    .from("corrections")
    .select("id, data, descricao, antes, depois")
    .eq("indicador_slug", slug)
    .gte("data", limite)
    .order("data", { ascending: false });
  if (e4) throw new Error(`corrections: ${e4.message}`);

  const template = parseTemplate(
    await readFile(join(configDir(), "templates", indicator.frase_template), "utf8"),
  );

  return {
    indicator,
    principal,
    reserva,
    nominal,
    exibida: escolhida,
    usandoReserva,
    proxima,
    atualizadoEm: divulgacao ?? latest.collectedAt,
    atraso,
    correcoesRecentes: correcoes,
    template,
  };
}

export type Revision = { refDate: string; value: number; revision: number; collectedAt: string };

export async function getRevisions(seriesId: string): Promise<Revision[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(`revisoes:${seriesId}`);
  const db = client();
  // Períodos que já tiveram revisão: traz todas as versões deles.
  const { data: revised, error } = await db
    .from("observations")
    .select("ref_date")
    .eq("series_id", seriesId)
    .gt("revision", 0);
  if (error) throw new Error(`revisões ${seriesId}: ${error.message}`);
  const refs = [...new Set(revised.map((r) => r.ref_date as string))];
  if (refs.length === 0) return [];
  const { data, error: e2 } = await db
    .from("observations")
    .select("ref_date, value, revision, collected_at")
    .eq("series_id", seriesId)
    .in("ref_date", refs)
    .order("ref_date", { ascending: false })
    .order("revision", { ascending: true });
  if (e2) throw new Error(`revisões ${seriesId}: ${e2.message}`);
  return data.map((r) => ({
    refDate: r.ref_date,
    value: Number(r.value),
    revision: r.revision,
    collectedAt: r.collected_at,
  }));
}

export async function getCorrections(slug?: string): Promise<(Correction & { indicador_slug: string | null })[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("correcoes");
  let q = client().from("corrections").select("id, data, descricao, antes, depois, indicador_slug");
  if (slug) q = q.eq("indicador_slug", slug);
  const { data, error } = await q.order("data", { ascending: false });
  if (error) throw new Error(`corrections: ${error.message}`);
  return data;
}

/**
 * Link para o dado da própria série na fonte. Os padrões foram testados contra as fontes
 * em 01/11/2026 (docs/05): página da tabela no SIDRA e API do SGS com os últimos valores.
 * Para outra fonte, vale o link registrado em config/sources.yaml.
 */
export function seriesUrl(source: Source, series: Series): string | null {
  if (source.id === "ibge_agregados") return `https://sidra.ibge.gov.br/tabela/${series.codigo_externo.split("/")[0]}`;
  if (source.id === "bcb_sgs")
    return `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series.codigo_externo}/dados/ultimos/12?formato=json`;
  return source.url_fonte;
}
