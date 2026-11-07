// Aba Impostos (docs/10, 2.7) e "o que o mercado espera" (2.1). Só leitura do banco:
// marcos da lei (config/impostos.yaml), projetos da Câmara, arrecadação da Receita e
// medianas do Focus, gravados pelos jobs arrecadacao, impostos e focus.

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { client, getSeriesBundle, type SeriesBundle } from "./data";
import { todayInBrazil } from "./format";
import { getIndiceIpca } from "./ferramentas";
import { corrige, type Ponto } from "./real";

export type Marco = {
  id: string;
  vigencia: string;
  publico: ("pf" | "pj")[];
  titulo: string;
  texto: string;
  lei: string;
  url: string;
  /** URNs dos dispositivos lidos na conferência (normas.leg.br). */
  dispositivos: string[];
  conferidoPor: string | null;
  conferidoEm: string | null;
};

/**
 * Marcos da linha do tempo. Só vão para o site os aprovados na conferência automática
 * contra o texto da lei (pipelines/agentes/conferir_marcos.py; docs/02, seção 9).
 * `rascunhos` mostra também os reprovados, só para revisão local (OBRASA_MARCOS_RASCUNHO=1).
 */
export async function getMarcos(rascunhos = false): Promise<{ marcos: Marco[]; hoje: string }> {
  "use cache";
  cacheLife("hours");
  cacheTag("impostos");
  let q = client()
    .from("marcos_tributarios")
    .select("id, vigencia, publico, titulo, texto, lei, url, dispositivos, conferido_por, conferido_em")
    .order("vigencia")
    .order("id");
  if (!rascunhos) q = q.not("conferido_em", "is", null);
  const { data, error } = await q;
  if (error) throw new Error(`marcos_tributarios: ${error.message}`);
  const marcos = data.map((r) => ({
    id: r.id,
    vigencia: r.vigencia,
    publico: r.publico,
    titulo: r.titulo,
    texto: r.texto,
    lei: r.lei,
    url: r.url,
    dispositivos: r.dispositivos,
    conferidoPor: r.conferido_por,
    conferidoEm: r.conferido_em,
  }));
  return { marcos, hoje: todayInBrazil() };
}

export type Proposicao = {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
  situacao: string | null;
  orgao: string | null;
  /** Data da última tramitação (AAAA-MM-DD); nula se a Câmara a registrou no futuro. */
  ultimaTramitacao: string | null;
  url: string;
  coletadoEm: string;
};

export async function getProposicoes(): Promise<Proposicao[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("impostos");
  const { data, error } = await client()
    .from("proposicoes")
    .select("id, sigla_tipo, numero, ano, ementa, situacao, orgao, ultima_tramitacao, url, coletado_em")
    .order("ultima_tramitacao", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`proposicoes: ${error.message}`);
  const hoje = todayInBrazil();
  return data.map((r) => ({
    id: r.id,
    siglaTipo: r.sigla_tipo,
    numero: r.numero,
    ano: r.ano,
    ementa: r.ementa,
    situacao: r.situacao,
    orgao: r.orgao,
    ultimaTramitacao:
      r.ultima_tramitacao && r.ultima_tramitacao.slice(0, 10) <= hoje ? r.ultima_tramitacao.slice(0, 10) : null,
    url: r.url,
    coletadoEm: r.coletado_em,
  }));
}

/** Grupos de tributos na ordem da tela, como em config/impostos.yaml. */
export const GRUPOS = [
  "imposto-de-renda",
  "previdencia",
  "cofins",
  "pis-pasep",
  "csll",
  "ipi",
  "iof",
  "comercio-exterior",
  "outros",
] as const;

export type Arrecadacao = {
  total: SeriesBundle;
  /** Total corrigido pelo IPCA, a preços de `base` (regra 3). */
  totalReal: Ponto[];
  base: string;
  ipca: { orgao: string; url: string | null; ref: string };
  /** Soma dos últimos 12 meses por grupo, a preços de `base`, em R$ milhões. */
  doze: { id: string; nome: string; valor: number }[];
  dozeDe: string;
  dozeAte: string;
};

export async function getArrecadacao(): Promise<Arrecadacao | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("indicadores", "impostos");
  const total = await getSeriesBundle("receita_arrecadacao_total");
  if (total.obs.length === 0) return null;
  const grupos = await Promise.all(
    GRUPOS.map(async (id) => ({
      id,
      bundle: await getSeriesBundle(`receita_arrecadacao_${id}`),
    })),
  );
  const indice = await getIndiceIpca();
  const { pontos: totalReal, base } = corrige(total.obs, indice.pontos);
  const ultimos = totalReal.slice(-12);
  const meses = new Set(ultimos.map((p) => p.refDate));
  const doze = grupos.map(({ id, bundle }) => ({
    id,
    nome: bundle.series.nome.replace(/ \(R\$ milhões correntes\)$/, ""),
    valor: corrige(bundle.obs, indice.pontos, base)
      .pontos.filter((p) => meses.has(p.refDate))
      .reduce((s, p) => s + p.value, 0),
  }));
  return {
    total,
    totalReal,
    base,
    ipca: {
      orgao: indice.fonte.orgao,
      url: indice.fonte.url,
      ref: indice.fonte.ref,
    },
    doze,
    dozeDe: ultimos[0].refDate,
    dozeAte: ultimos.at(-1)!.refDate,
  };
}

export type Expectativa = {
  ano: number;
  mediana: number;
  respondentes: number | null;
};
export type Expectativas = {
  indicador: string;
  dataPesquisa: string;
  anos: Expectativa[];
};

/** Medianas da pesquisa Focus mais recente para o ano corrente e o seguinte. */
export async function getExpectativas(indicador: string): Promise<Expectativas | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("focus");
  const anoAtual = Number(todayInBrazil().slice(0, 4));
  const db = client();
  const { data: ultima, error } = await db
    .from("expectativas")
    .select("data_pesquisa")
    .eq("indicador", indicador)
    .order("data_pesquisa", { ascending: false })
    .limit(1);
  if (error) throw new Error(`expectativas: ${error.message}`);
  if (!ultima.length) return null;
  const dataPesquisa = ultima[0].data_pesquisa as string;
  const { data, error: e2 } = await db
    .from("expectativas")
    .select("ano_referencia, mediana, respondentes")
    .eq("indicador", indicador)
    .eq("data_pesquisa", dataPesquisa)
    .eq("base_calculo", 0)
    .in("ano_referencia", [anoAtual, anoAtual + 1])
    .order("ano_referencia");
  if (e2) throw new Error(`expectativas: ${e2.message}`);
  if (!data.length) return null;
  return {
    indicador,
    dataPesquisa,
    anos: data.map((r) => ({
      ano: r.ano_referencia,
      mediana: Number(r.mediana),
      respondentes: r.respondentes,
    })),
  };
}
