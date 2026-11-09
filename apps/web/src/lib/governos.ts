// Aba Governos (docs/10, 3.7.1; D27). Só leitura do banco: mandatos conferidos e metas de
// inflação gravados pelo job governos; indicadores das séries de config/governos.yaml.
// As contas (ponto de posse, ponto de fim, variação, valor real) são lib/mandato.ts e
// lib/real.ts, sobre valores do banco.

import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { parse as parseYaml } from "yaml";
import { client, configDir, getSeriesBundle, seriesUrl, transforma, type SeriesBundle } from "./data";
import { getIndiceIpca, type IndiceIpca } from "./ferramentas";
import { lastOfMonth } from "./indicator";
import type { FrequenciaRef } from "./format";
import { todayInBrazil } from "./format";
import { anosDoMandato, posseEFim, variacao, type Ponto } from "./mandato";
import { corrige } from "./real";

export type Prova = { trecho: string; urn?: string; versao?: string; url?: string };

/** Retrato oficial no Wikimedia Commons, carregado de lá (não copiado para o oBrasa). */
export type Foto = { url: string; pagina: string; autor: string; licenca: string };

export type Mandato = {
  slug: string;
  ordem: number;
  presidente: string;
  rotulo: string;
  inicio: string;
  fim: string | null;
  nota: string | null;
  provas: Prova[];
  foto: Foto;
  conferidoEm: string;
};

type IndicadorCfg = { id: string; titulo: string; serie: string; transformacao?: "inverter_sinal"; casas?: number };

/** Mandatos conferidos pelo job governos, como estão no banco. A tela usa getMandatosCompletos. */
async function getMandatosDoBanco(): Promise<Mandato[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("governos");
  const { data, error } = await client()
    .from("mandatos")
    .select("slug, ordem, presidente, rotulo, inicio, fim, nota, provas, foto, conferido_em")
    .order("ordem");
  if (error) throw new Error(`mandatos: ${error.message}`);
  return data.map((r) => ({
    slug: r.slug,
    ordem: r.ordem,
    presidente: r.presidente,
    rotulo: r.rotulo,
    inicio: r.inicio,
    fim: r.fim,
    nota: r.nota,
    provas: r.provas as Prova[],
    foto: r.foto as Foto,
    conferidoEm: r.conferido_em,
  }));
}

/**
 * Slugs de todos os mandatos de config/governos.yaml, sem depender do banco. Servem para o
 * build gerar as páginas: com Cache Components, `generateStaticParams` não pode voltar vazio,
 * e o banco fica sem mandatos quando a conferência do job falha (ou antes da primeira coleta).
 * Mandato que não estiver completo no banco cai em notFound() na própria página.
 */
export async function getSlugsDoConfig(): Promise<string[]> {
  const cfg = parseYaml(await readFile(join(configDir(), "governos.yaml"), "utf8")) as { mandatos: { slug: string }[] };
  return cfg.mandatos.map((m) => m.slug);
}

async function indicadoresCfg(): Promise<IndicadorCfg[]> {
  const cfg = parseYaml(await readFile(join(configDir(), "governos.yaml"), "utf8")) as { indicadores: IndicadorCfg[] };
  return cfg.indicadores;
}

export type PontoReal = Ponto & { real: number | null };

export type LinhaIndicador = {
  id: string;
  titulo: string;
  casas: number;
  bundle: SeriesBundle;
  freq: FrequenciaRef;
  posse: PontoReal | null;
  fim: PontoReal | null;
  /** Variação entre posse e fim; em série monetária, sobre o valor real. */
  variacao: { valor: number; unidade: "p.p." | "%" } | null;
  /**
   * Caminho do indicador da posse ao fim, um ponto por período (série diária: o último dia
   * de cada mês, mais os dois pontos das pontas). Em série monetária, o valor real.
   */
  trajeto: Ponto[];
};

export type BlocoPosseFim = {
  linhas: LinhaIndicador[];
  /** Mês-base do valor real (regra 3) e a fonte do IPCA usado na correção. */
  base: string;
  ipca: IndiceIpca["fonte"];
};

function trajeto(
  pts: Ponto[],
  reais: Map<string, number> | null,
  freq: FrequenciaRef,
  posse: Ponto | null,
  fim: Ponto | null,
): Ponto[] {
  if (!posse || !fim) return [];
  let meio = pts.filter((p) => p.refDate >= posse.refDate && p.refDate <= fim.refDate);
  if (freq === "diaria") meio = [posse, ...lastOfMonth(meio.slice(1, -1)), fim];
  return meio.map((p) => ({ refDate: p.refDate, value: reais ? (reais.get(p.refDate) ?? p.value) : p.value }));
}

/** O mandato tem todos os indicadores antes da posse e no fim (D27)? */
export function completo(b: BlocoPosseFim): boolean {
  return b.linhas.length > 0 && b.linhas.every((l) => l.posse !== null && l.fim !== null && l.variacao !== null);
}

/**
 * Só os mandatos com todos os indicadores antes da posse e no fim (D27, decisão de
 * 08/11/2026). Mandato que perder um ponto (série que falhou, revisão) some da aba até
 * voltar a ter todos; o oBrasa não troca de pesquisa para preencher.
 */
export async function getMandatos(): Promise<Mandato[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("governos", "indicadores");
  const todos = await getMandatosDoBanco();
  const blocos = await Promise.all(todos.map((m) => getPosseEFim(m)));
  return todos.filter((_, i) => completo(blocos[i]));
}

function comReal(p: Ponto | null, reais: Map<string, number> | null): PontoReal | null {
  if (!p) return null;
  return { ...p, real: reais ? (reais.get(p.refDate) ?? null) : null };
}

export async function getPosseEFim(m: Mandato): Promise<BlocoPosseFim> {
  "use cache";
  cacheLife("hours");
  cacheTag("governos", "indicadores");
  const hoje = todayInBrazil();
  const indice = await getIndiceIpca();
  const base = `${indice.pontos.at(-1)![0]}-01`;
  const linhas: LinhaIndicador[] = [];
  for (const cfg of await indicadoresCfg()) {
    const bundle = transforma(await getSeriesBundle(cfg.serie), cfg.transformacao ?? null);
    const freq = bundle.series.frequencia as FrequenciaRef;
    let pts: Ponto[] = bundle.obs.map((o) => ({ refDate: o.refDate, value: o.value }));
    let reais: Map<string, number> | null = null;
    if (bundle.series.monetaria) {
      // Só os meses que já têm IPCA: o valor real precisa existir para o ponto escolhido.
      const c = corrige(pts, indice.pontos, base);
      reais = new Map(c.pontos.map((p) => [p.refDate, p.value]));
      pts = pts.filter((p) => reais!.has(p.refDate));
    }
    const r = posseEFim(pts, freq, m.inicio, m.fim, hoje);
    const posse = comReal(r.posse, reais);
    const fim = comReal(r.fim, reais);
    let v: LinhaIndicador["variacao"] = null;
    if (posse && fim) {
      const de = reais ? posse.real : posse.value;
      const para = reais ? fim.real : fim.value;
      if (de !== null && para !== null && !(bundle.series.tipo === "nivel" && de === 0)) {
        v = variacao(bundle.series.tipo, de, para);
      }
    }
    linhas.push({
      id: cfg.id,
      titulo: cfg.titulo,
      casas: cfg.casas ?? 2,
      bundle,
      freq,
      posse,
      fim,
      variacao: v,
      trajeto: trajeto(pts, reais, freq, posse, fim),
    });
  }
  return { linhas, base, ipca: indice.fonte };
}

export type MetaInflacao = {
  ano: number;
  continua: boolean;
  meta: number;
  tolerancia: number;
  inferior: number;
  superior: number;
  normas: string[];
  metaOriginal: number | null;
  metaAjustada: number | null;
  nota: string | null;
  cartaAberta: boolean | null;
  cartaUrl: string | null;
  /** IPCA em 12 meses de dezembro do ano, do banco (IBGE). Null: dezembro ainda não saiu. */
  ipcaDezembro: number | null;
};

export type BlocoMetas = {
  metas: MetaInflacao[];
  ipca: SeriesBundle;
  fonteMetas: { orgao: string; url: string; coletadoEm: string } | null;
};

const SERIE_IPCA_12M = "ibge_agregados_1737_2265";

export async function getMetasInflacao(m: Mandato): Promise<BlocoMetas> {
  "use cache";
  cacheLife("hours");
  cacheTag("governos", "indicadores");
  const anos = anosDoMandato(m.inicio, m.fim, todayInBrazil());
  const ipca = await getSeriesBundle(SERIE_IPCA_12M);
  const dezembro = new Map(
    ipca.obs.filter((o) => o.refDate.slice(5, 7) === "12").map((o) => [Number(o.refDate.slice(0, 4)), o.value]),
  );
  const { data, error } = await client()
    .from("metas_inflacao")
    .select(
      "ano, continua, meta, tolerancia, inferior, superior, normas, meta_original, meta_ajustada, nota, carta_aberta, carta_url, coletado_em, source_id",
    )
    .in("ano", anos.length ? anos : [0])
    .order("ano");
  if (error) throw new Error(`metas_inflacao: ${error.message}`);
  const num = (x: unknown) => (x === null ? null : Number(x));
  const metas = data.map((r) => ({
    ano: r.ano,
    continua: r.continua,
    meta: Number(r.meta),
    tolerancia: Number(r.tolerancia),
    inferior: Number(r.inferior),
    superior: Number(r.superior),
    normas: r.normas,
    metaOriginal: num(r.meta_original),
    metaAjustada: num(r.meta_ajustada),
    nota: r.nota,
    cartaAberta: r.carta_aberta,
    cartaUrl: r.carta_url,
    ipcaDezembro: dezembro.get(r.ano) ?? null,
  }));
  let fonteMetas: BlocoMetas["fonteMetas"] = null;
  if (data.length) {
    const { data: src } = await client()
      .from("sources")
      .select("orgao, url_fonte")
      .eq("id", data[0].source_id)
      .single();
    if (src?.url_fonte) fonteMetas = { orgao: src.orgao, url: src.url_fonte, coletadoEm: data[0].coletado_em };
  }
  return { metas, ipca, fonteMetas };
}

export type NormaFederal = {
  tipo: "EMC" | "LCP";
  numero: number;
  data: string;
  nome: string;
  ementa: string;
  url: string;
  impostos: boolean;
};

export type BlocoNormas = {
  normas: NormaFederal[];
  fonte: { orgao: string; url: string; coletadoEm: string } | null;
};

/** Bloco 4: emendas à Constituição e leis complementares assinadas durante o mandato. */
export async function getNormasDoMandato(m: Mandato): Promise<BlocoNormas> {
  "use cache";
  cacheLife("hours");
  cacheTag("governos");
  const { data, error } = await client()
    .from("normas_federais")
    .select("tipo, numero, data, nome, ementa, url, impostos, coletado_em, source_id")
    .gte("data", m.inicio)
    .lte("data", m.fim ?? "9999-12-31")
    .order("data")
    .order("numero");
  if (error) throw new Error(`normas_federais: ${error.message}`);
  let fonte: BlocoNormas["fonte"] = null;
  if (data.length) {
    const { data: src } = await client()
      .from("sources")
      .select("orgao, url_fonte")
      .eq("id", data[0].source_id)
      .single();
    if (src?.url_fonte) fonte = { orgao: src.orgao, url: src.url_fonte, coletadoEm: data[0].coletado_em };
  }
  return {
    normas: data.map((r) => ({
      tipo: r.tipo as NormaFederal["tipo"],
      numero: r.numero,
      data: r.data,
      nome: r.nome,
      ementa: r.ementa,
      url: r.url,
      impostos: r.impostos,
    })),
    fonte,
  };
}

export type TrechoPlano = { pagina: number; trecho: string; indicador: { id: string; titulo: string } | null };

/** Bloco 3: o plano registrado no TSE pela candidatura eleita e os trechos com número. */
export type BlocoPlano =
  | {
      tipo: "plano";
      ano: number;
      arquivo: string;
      urlPacote: string;
      paginas: number;
      conferidoEm: string;
      trechos: TrechoPlano[];
      fonte: { orgao: string; url: string };
    }
  | { tipo: "sem_plano"; frase: string; ver: { slug: string; rotulo: string } | null }
  | { tipo: "pendente" };

export async function getPlanoDoMandato(m: Mandato): Promise<BlocoPlano> {
  "use cache";
  cacheLife("hours");
  cacheTag("governos");
  const cfg = parseYaml(await readFile(join(configDir(), "governos.yaml"), "utf8")) as {
    mandatos: { slug: string; rotulo: string; sem_plano?: string; ver_plano?: string }[];
  };
  const proprio = cfg.mandatos.find((x) => x.slug === m.slug);
  if (proprio?.sem_plano) {
    const outro = cfg.mandatos.find((x) => x.slug === proprio.ver_plano);
    return {
      tipo: "sem_plano",
      frase: proprio.sem_plano,
      ver: outro ? { slug: outro.slug, rotulo: outro.rotulo } : null,
    };
  }
  const { data: plano, error } = await client()
    .from("planos")
    .select("ano, arquivo, url_pacote, paginas, conferido_em")
    .eq("mandato", m.slug)
    .maybeSingle();
  if (error) throw new Error(`planos: ${error.message}`);
  if (!plano) return { tipo: "pendente" };
  const [{ data: trechos, error: e2 }, { data: src }, indicadores] = await Promise.all([
    client().from("planos_trechos").select("pagina, trecho, indicador").eq("mandato", m.slug).order("ordem"),
    client().from("sources").select("orgao, url_fonte").eq("id", "tse_planos_governo").single(),
    indicadoresCfg(),
  ]);
  if (e2) throw new Error(`planos_trechos: ${e2.message}`);
  const titulo = new Map(indicadores.map((i) => [i.id, i.titulo]));
  return {
    tipo: "plano",
    ano: plano.ano,
    arquivo: plano.arquivo,
    urlPacote: plano.url_pacote,
    paginas: plano.paginas,
    conferidoEm: plano.conferido_em,
    trechos: trechos.map((t) => ({
      pagina: t.pagina,
      // o PDF quebra linha no meio da frase; na tela, o trecho corre como texto
      trecho: t.trecho.replace(/\s+/g, " ").trim(),
      indicador: t.indicador && titulo.has(t.indicador) ? { id: t.indicador, titulo: titulo.get(t.indicador)! } : null,
    })),
    fonte: { orgao: src?.orgao ?? "TSE", url: src?.url_fonte ?? plano.url_pacote },
  };
}

/** Um indicador ao longo de todos os mandatos (gráfico de /governos; DESIGN.md, `mandate-band`). */
export type SerieTodosMandatos = {
  id: string;
  titulo: string;
  casas: number;
  unidade: string;
  freq: FrequenciaRef;
  /** Série diária vira o último dia de cada mês. Em série monetária, o valor real. */
  pontos: Ponto[];
  /** Só em série monetária (regra 3): os mesmos períodos, em valor nominal. */
  nominais: Ponto[] | null;
  fonte: { orgao: string; url: string | null; ultimo: string };
};

export type BlocoTodosMandatos = {
  mandatos: { slug: string; rotulo: string; presidente: string; inicio: string; fim: string | null; foto: string }[];
  series: SerieTodosMandatos[];
  /** Mês-base do valor real e a fonte do IPCA da correção. */
  base: string;
  ipca: IndiceIpca["fonte"];
};

export async function getTodosMandatos(): Promise<BlocoTodosMandatos> {
  "use cache";
  cacheLife("hours");
  cacheTag("governos", "indicadores");
  const mandatos = await getMandatos();
  const indice = await getIndiceIpca();
  const base = `${indice.pontos.at(-1)![0]}-01`;
  const series: SerieTodosMandatos[] = [];
  if (mandatos.length === 0) return { mandatos: [], series, base, ipca: indice.fonte };
  // O gráfico começa no ponto "antes da posse" do primeiro mandato, o mesmo da página dele.
  const primeiro = await getPosseEFim(mandatos[0]);
  for (const cfg of await indicadoresCfg()) {
    const bundle = transforma(await getSeriesBundle(cfg.serie), cfg.transformacao ?? null);
    const freq = bundle.series.frequencia as FrequenciaRef;
    const desde = primeiro.linhas.find((l) => l.id === cfg.id)?.posse?.refDate;
    if (!desde) continue;
    let pts: Ponto[] = bundle.obs.filter((o) => o.refDate >= desde).map((o) => ({ refDate: o.refDate, value: o.value }));
    if (freq === "diaria") pts = [pts[0], ...lastOfMonth(pts.slice(1))];
    let nominais: Ponto[] | null = null;
    if (bundle.series.monetaria) {
      const reais = new Map(corrige(pts, indice.pontos, base).pontos.map((p) => [p.refDate, p.value]));
      nominais = pts.filter((p) => reais.has(p.refDate));
      pts = nominais.map((p) => ({ refDate: p.refDate, value: reais.get(p.refDate)! }));
    }
    if (pts.length < 2) continue;
    series.push({
      id: cfg.id,
      titulo: cfg.titulo,
      casas: cfg.casas ?? 2,
      unidade: bundle.series.unidade,
      freq,
      pontos: pts,
      nominais,
      fonte: { orgao: bundle.source.orgao, url: seriesUrl(bundle.source, bundle.series), ultimo: pts.at(-1)!.refDate },
    });
  }
  return {
    mandatos: mandatos.map((m) => ({
      slug: m.slug,
      rotulo: m.rotulo,
      presidente: m.presidente,
      inicio: m.inicio,
      fim: m.fim,
      foto: m.foto.url,
    })),
    series,
    base,
    ipca: indice.fonte,
  };
}
