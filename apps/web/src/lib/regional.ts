// Mapas por estado (DESIGN.md, "mapa-uf"). Valores de observacoes_uf (job `regional`,
// IBGE nível UF) e malha das UFs do IBGE (malhas_atual). O desenho é calculado aqui, no
// servidor; o navegador só recebe os caminhos prontos.

import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { geoConicEqualArea, geoPath } from "d3-geo";
import { cacheLife, cacheTag } from "next/cache";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { parse as parseYaml } from "yaml";
import { client, configDir } from "./data";
import { getMalha } from "./eleicoes";

export const MAPA_W = 600;
export const MAPA_H = 600;

type MapaCfg = {
  id: string;
  tema: string;
  titulo: string;
  indicador: string;
  tabela: number;
  frequencia: "mensal" | "trimestral_movel" | "trimestral" | "anual";
  unidade: string;
  casas: number;
};

export type DesenhoUf = {
  ufs: { uf: number; d: string }[];
  divisas: string;
  borda: string;
};

export type MapaUfDados = {
  id: string;
  titulo: string;
  indicador: string;
  unidade: string;
  casas: number;
  frequencia: MapaCfg["frequencia"];
  fonte: { orgao: string; url: string };
  /** Períodos em ordem (AAAA-MM-DD). */
  periodos: string[];
  /** valores[período][uf] */
  valores: Record<string, Record<number, number>>;
  nomes: Record<number, string>;
};

export async function getDesenhoUf(): Promise<DesenhoUf> {
  "use cache";
  cacheLife("days");
  cacheTag("malhas");
  const malha = (await getMalha("br_ufs")).topo as Topology;
  const obj = malha.objects.BRUF as GeometryCollection<{ codarea: string }>;
  const contorno = feature(malha, obj);
  const proj = geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]).fitSize([MAPA_W, MAPA_H], contorno);
  const path = geoPath(proj);
  const r = (s: string | null) => (s ?? "").replace(/(\d+\.\d)\d+/g, "$1"); // 1 casa basta a 600px
  return {
    ufs: contorno.features.map((f) => ({ uf: Number(f.properties.codarea), d: r(path(f)) })),
    divisas: r(path(mesh(malha, obj, (a, b) => a !== b))),
    borda: r(path(mesh(malha, obj, (a, b) => a === b))),
  };
}

export async function getMapasUf(tema: string): Promise<MapaUfDados[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("indicadores", "mapas-uf");
  const cfg = (parseYaml(await readFile(join(configDir(), "regional.yaml"), "utf8")) as { mapas: MapaCfg[] }).mapas.filter(
    (m) => m.tema === tema,
  );
  const db = client();
  const out: MapaUfDados[] = [];
  for (const m of cfg) {
    const { data, error } = await db
      .from("observacoes_uf_atual") // revisão mais recente de cada valor
      .select("uf, uf_nome, ref_date, value, sources(orgao)")
      .eq("mapa_id", m.id)
      .order("ref_date")
      .limit(5000);
    if (error) throw new Error(`observacoes_uf ${m.id}: ${error.message}`);
    if (!data.length) continue; // mapa ainda não coletado: pipelines.run regional
    const valores: MapaUfDados["valores"] = {};
    const nomes: Record<number, string> = {};
    for (const r of data as unknown as { uf: number; uf_nome: string; ref_date: string; value: string }[]) {
      (valores[r.ref_date] ??= {})[r.uf] = Number(r.value);
      nomes[r.uf] = r.uf_nome;
    }
    // Só períodos com as 27 UFs: um mapa com buracos esconderia estados.
    const periodos = Object.keys(valores)
      .filter((p) => Object.keys(valores[p]).length === 27)
      .sort();
    if (!periodos.length) continue;
    const orgao = (data[0] as unknown as { sources: { orgao: string } }).sources.orgao;
    out.push({
      id: m.id,
      titulo: m.titulo,
      indicador: m.indicador,
      unidade: m.unidade,
      casas: m.casas,
      frequencia: m.frequencia,
      fonte: { orgao, url: `https://sidra.ibge.gov.br/tabela/${m.tabela}` },
      periodos,
      valores,
      nomes,
    });
  }
  return out;
}
