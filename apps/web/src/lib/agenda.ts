// Agenda (DESIGN.md, "Ferramentas"): datas de divulgação marcadas pelos órgãos.
// IBGE: releases.proxima_divulgacao (calendário oficial do IBGE, gravado pelo job `series`)
// e releases.divulgado_em (o que já saiu). Copom: agenda_eventos (config/copom.yaml,
// conferido pelo job `agenda`). Nenhuma data é estimada aqui.

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { client } from "./data";
import { addMonths, formatRef, todayInBrazil, type FrequenciaRef } from "./format";

export type Evento = {
  id: string;
  /** Dia em que sai o dado ou a decisão (AAAA-MM-DD). */
  data: string;
  /** Primeiro dia, quando o evento dura mais de um dia (reunião do Copom). */
  inicio: string;
  orgao: string;
  titulo: string;
  /** Rótulo curto para a célula do calendário. */
  curto: string;
  /** "divulga" (IBGE) ou "decide" (Copom). */
  verbo: "divulga" | "decide";
  itens: { href: string; rotulo: string }[];
  fonte: string | null;
  ja: boolean;
};

type ReleaseRow = {
  series_id: string;
  ref_date: string;
  divulgado_em: string | null;
  proxima_divulgacao: string | null;
  series: { frequencia: FrequenciaRef; sources: { orgao: string; url_fonte: string | null } };
};

export async function getAgenda(): Promise<{ eventos: Evento[]; hoje: string; de: string; ate: string }> {
  "use cache";
  cacheLife("hours");
  cacheTag("indicadores", "agenda");
  const db = client();
  const hoje = todayInBrazil();
  const de = addMonths(`${hoje.slice(0, 7)}-01`, -1);
  const ate = addMonths(`${hoje.slice(0, 7)}-01`, 7);

  const [indicadores, futuras, passadas, copom] = await Promise.all([
    db.from("indicators").select("slug, titulo, series_id, ordem").order("ordem"),
    db
      .from("releases")
      .select("series_id, ref_date, divulgado_em, proxima_divulgacao, series(frequencia, sources(orgao, url_fonte))")
      .gte("proxima_divulgacao", de)
      .lt("proxima_divulgacao", ate),
    db
      .from("releases")
      .select("series_id, ref_date, divulgado_em, proxima_divulgacao, series(frequencia, sources(orgao, url_fonte))")
      .gte("divulgado_em", de)
      .lt("divulgado_em", ate),
    db.from("agenda_eventos").select("chave, titulo, inicio, fim, url, sources(orgao)").gte("fim", de).lt("inicio", ate),
  ]);
  for (const r of [indicadores, futuras, passadas, copom]) if (r.error) throw new Error(`agenda: ${r.error.message}`);

  const porSerie = new Map<string, { slug: string; titulo: string }[]>();
  for (const i of indicadores.data ?? []) {
    porSerie.set(i.series_id, [...(porSerie.get(i.series_id) ?? []), { slug: i.slug, titulo: i.titulo }]);
  }

  // Uma linha por dia e período de referência: o IPCA sai em três séries no mesmo dia.
  const grupos = new Map<string, Evento>();
  const linhas = [...((futuras.data ?? []) as unknown as ReleaseRow[]), ...((passadas.data ?? []) as unknown as ReleaseRow[])];
  for (const r of linhas) {
    const ind = porSerie.get(r.series_id);
    const dia = r.divulgado_em ? todayInBrazil(new Date(r.divulgado_em)) : r.proxima_divulgacao;
    if (!ind || !dia || dia < de || dia >= ate) continue;
    const ref = formatRef(r.ref_date, r.series.frequencia);
    const chave = `${dia}|${r.series.sources.orgao}|${ref}`;
    const ev = grupos.get(chave) ?? {
      id: chave,
      data: dia,
      inicio: dia,
      orgao: r.series.sources.orgao,
      titulo: `Período de referência: ${ref}`,
      curto: ind[0].titulo,
      verbo: "divulga" as const,
      itens: [],
      fonte: r.series.sources.url_fonte,
      ja: dia < hoje || r.divulgado_em != null,
    };
    for (const i of ind) {
      if (!ev.itens.some((x) => x.href.endsWith(`/${i.slug}`))) ev.itens.push({ href: `/indicador/${i.slug}`, rotulo: i.titulo });
    }
    grupos.set(chave, ev);
  }

  type CopomRow = { chave: string; titulo: string; inicio: string; fim: string; url: string | null; sources: { orgao: string } };
  const eventos = [
    ...grupos.values(),
    ...((copom.data ?? []) as unknown as CopomRow[]).map((c) => ({
      id: c.chave,
      data: c.fim,
      inicio: c.inicio,
      orgao: c.sources.orgao,
      titulo: c.titulo,
      curto: "Copom",
      verbo: "decide" as const,
      itens: [{ href: "/indicador/selic", rotulo: "Taxa básica de juros (meta Selic)" }],
      fonte: c.url,
      ja: c.fim < hoje,
    })),
  ].sort((a, b) => a.data.localeCompare(b.data) || a.orgao.localeCompare(b.orgao));
  return { eventos, hoje, de, ate };
}
