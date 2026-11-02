// Leitura dos resultados das Eleições 2026 (TSE) para as páginas. Todo número exibido
// sai das views do banco (supabase/migrations/20261103000000_eleicoes.sql); nada é
// calculado além de percentuais e somas sobre esses números.

import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { parse as parseYaml } from "yaml";
import { client, configDir } from "./data";

export const CARGO_PRESIDENTE = "PRESIDENTE";

export type Turno = 1 | 2;

export type CandidatoPresidente = {
  nr: number;
  nome: string;
  partido: string;
  federacao: string | null;
  /** DS_SIT_TOT_TURNO de cada turno, com as palavras do TSE ("ELEITO", "2º TURNO", ...). */
  situacao: Partial<Record<Turno, string>>;
};

export type Apuracao = {
  turno: Turno;
  data: string;
  uf: string;
  aptos: number;
  comparecimento: number;
  abstencoes: number;
  naoInstaladas: number;
  validos: number;
  brancos: number;
  nulos: number;
};

export type VotoUf = { turno: Turno; uf: string; nr: number; votos: number };

export type Eleito = { cargo: string; uf: string; nome: string; partido: string; turno: Turno };

export type Coleta = {
  arquivo: string;
  url: string;
  geradoEm: string | null;
  coletadoEm: string;
  verificadoEm: string;
};

export type ArquivoTse = { zip: string; membro: string; pagina: string };

type Chave = "apuracao" | "votos_presidente" | "candidatos";

export type EleicaoView = {
  ano: number;
  candidatos: CandidatoPresidente[];
  apuracao: Apuracao[];
  votos: VotoUf[];
  partidos: { cargo: string; partido: string; eleitos: number }[];
  eleitos: Eleito[];
  coletas: Record<Chave, Coleta | null>;
  arquivos: Record<Chave, ArquivoTse>;
};

type Config = { ano: number; arquivos: Record<Chave, ArquivoTse> };

async function readConfig(): Promise<Config> {
  return parseYaml(await readFile(join(configDir(), "eleicoes.yaml"), "utf8")) as Config;
}

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error || r.data === null) throw new Error(`${what}: ${r.error?.message ?? "sem dados"}`);
  return r.data;
}

export async function getEleicao(): Promise<EleicaoView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("eleicoes");
  const db = client();
  const cfg = await readConfig();

  const [cand, apur, votos, partidos, eleitos, coletas] = await Promise.all([
    db
      .from("eleicao_candidatos_atual")
      .select("turno, nr_candidato, nome_urna, sg_partido, sg_federacao, situacao")
      .eq("cargo", CARGO_PRESIDENTE),
    db.from("eleicao_apuracao_uf").select("*").eq("cargo", CARGO_PRESIDENTE),
    db.from("eleicao_votos_uf").select("turno, uf, nr_candidato, votos").eq("cargo", CARGO_PRESIDENTE),
    db.from("eleicao_eleitos_partido").select("cargo, sg_partido, eleitos"),
    db
      .from("eleicao_candidatos_atual")
      .select("cargo, uf, turno, nome_urna, sg_partido, situacao")
      .in("cargo", ["GOVERNADOR", "SENADOR", CARGO_PRESIDENTE])
      .like("situacao", "ELEITO%"),
    db.from("eleicao_coletas_atual").select("arquivo, url, gerado_em, coletado_em, verificado_em"),
  ]);

  const apuracao = must(apur, "eleicao_apuracao_uf");
  if (apuracao.length === 0) return null;

  const porNr = new Map<number, CandidatoPresidente>();
  for (const r of must(cand, "candidatos")) {
    const c: CandidatoPresidente = porNr.get(r.nr_candidato) ?? {
      nr: r.nr_candidato,
      nome: r.nome_urna,
      partido: r.sg_partido,
      federacao: r.sg_federacao,
      situacao: {},
    };
    c.situacao[r.turno as Turno] = r.situacao;
    porNr.set(r.nr_candidato, c);
  }

  const col = new Map<string, Coleta>(
    must(coletas, "coletas").map((c) => [
      c.arquivo,
      {
        arquivo: c.arquivo,
        url: c.url,
        geradoEm: c.gerado_em,
        coletadoEm: c.coletado_em,
        verificadoEm: c.verificado_em,
      },
    ]),
  );

  return {
    ano: cfg.ano,
    candidatos: [...porNr.values()],
    apuracao: apuracao.map((a) => ({
      turno: a.turno,
      data: a.data_eleicao,
      uf: a.uf,
      aptos: Number(a.aptos),
      comparecimento: Number(a.comparecimento),
      abstencoes: Number(a.abstencoes),
      naoInstaladas: Number(a.aptos_secoes_nao_instaladas),
      validos: Number(a.validos),
      brancos: Number(a.brancos),
      nulos: Number(a.nulos),
    })),
    votos: must(votos, "eleicao_votos_uf").map((v) => ({
      turno: v.turno,
      uf: v.uf,
      nr: v.nr_candidato,
      votos: Number(v.votos),
    })),
    partidos: must(partidos, "eleicao_eleitos_partido").map((p) => ({
      cargo: p.cargo,
      partido: p.sg_partido,
      eleitos: p.eleitos,
    })),
    eleitos: must(eleitos, "eleitos").map((e) => ({
      cargo: e.cargo,
      uf: e.uf,
      nome: e.nome_urna,
      partido: e.sg_partido,
      turno: e.turno,
    })),
    coletas: {
      apuracao: col.get(cfg.arquivos.apuracao.membro) ?? null,
      votos_presidente: col.get(cfg.arquivos.votos_presidente.membro) ?? null,
      candidatos: col.get(cfg.arquivos.candidatos.membro) ?? null,
    },
    arquivos: cfg.arquivos,
  };
}

/** Dados do mapa, num formato compacto: candidatos de cada turno e, por município,
 *  [código IBGE, votos válidos, votos de cada candidato na ordem de `candidatos`]. */
export type MapaPresidente = {
  municipios: Record<string, [string, string]>; // ibge → [nome, UF]
  turnos: Record<string, { candidatos: number[]; linhas: number[][] }>;
};

type LinhaMapa = { t: number; m: number; n: string; uf: string; val: number; v: Record<string, number> };

export async function getMapaPresidente(): Promise<MapaPresidente> {
  "use cache";
  cacheLife("hours");
  cacheTag("eleicoes");
  const rows = must(
    await client().rpc("eleicao_mapa", { p_cargo: CARGO_PRESIDENTE }),
    "eleicao_mapa",
  ) as LinhaMapa[];

  const municipios: MapaPresidente["municipios"] = {};
  const turnos: MapaPresidente["turnos"] = {};
  for (const r of rows) {
    municipios[r.m] = [r.n, r.uf];
    const t = (turnos[r.t] ??= { candidatos: [], linhas: [] });
    for (const nr of Object.keys(r.v)) if (!t.candidatos.includes(Number(nr))) t.candidatos.push(Number(nr));
  }
  for (const t of Object.values(turnos)) t.candidatos.sort((a, b) => a - b);
  for (const r of rows) {
    const t = turnos[r.t];
    t.linhas.push([r.m, r.val, ...t.candidatos.map((nr) => r.v[nr] ?? 0)]);
  }
  return { municipios, turnos };
}

export async function getMalha(
  id: "br_municipios" | "br_ufs",
): Promise<{ topo: unknown; url: string; coletadoEm: string }> {
  "use cache";
  cacheLife("days");
  cacheTag("malhas");
  const { data, error } = await client()
    .from("malhas_atual")
    .select("conteudo, url, coletado_em")
    .eq("id", id)
    .single();
  // .single() falha se a malha não existe (ainda não coletada: pipelines.run eleicoes)
  if (error || !data) throw new Error(`malha ${id}: ${error?.message ?? "sem dados"}`);
  return { topo: data.conteudo, url: data.url, coletadoEm: data.coletado_em };
}
