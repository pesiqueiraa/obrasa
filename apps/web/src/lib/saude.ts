// Vigia da esteira (docs/06, "Vigia"; config/saude.yaml). Diz se cada job rodou dentro do
// prazo e se ainda entram notícias. A rota /saude responde 503 quando algo passou do prazo,
// para um monitor de fora do GitHub avisar. Falha de execução não entra aqui: é assunto da
// issue de alerta (scripts/alerta.py).

import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { client, configDir } from "./data";

export type ConfigSaude = {
  jobs: Record<string, { horas: number; workflow: string }>;
  noticia_mais_recente_horas: number;
};

export type Leitura = {
  ultimaExecucao: Record<string, { terminadoEm: string; ok: boolean } | null>;
  noticiaMaisRecente: string | null;
};

export type Saude = {
  ok: boolean;
  verificadoEm: string;
  jobs: {
    job: string;
    workflow: string;
    prazoHoras: number;
    ultimaExecucao: string | null;
    ultimaOk: boolean | null;
    noPrazo: boolean;
  }[];
  noticias: { prazoHoras: number; maisRecente: string | null; noPrazo: boolean };
};

const HORA = 3_600_000;

function dentro(iso: string | null, horas: number, agora: Date): boolean {
  return iso !== null && agora.getTime() - new Date(iso).getTime() <= horas * HORA;
}

export function avalia(config: ConfigSaude, leitura: Leitura, agora: Date): Saude {
  const jobs = Object.entries(config.jobs).map(([job, { horas, workflow }]) => {
    const ultima = leitura.ultimaExecucao[job] ?? null;
    return {
      job,
      workflow,
      prazoHoras: horas,
      ultimaExecucao: ultima?.terminadoEm ?? null,
      ultimaOk: ultima?.ok ?? null,
      noPrazo: dentro(ultima?.terminadoEm ?? null, horas, agora),
    };
  });
  const horasNoticia = config.noticia_mais_recente_horas;
  const noticias = {
    prazoHoras: horasNoticia,
    maisRecente: leitura.noticiaMaisRecente,
    noPrazo: dentro(leitura.noticiaMaisRecente, horasNoticia, agora),
  };
  return {
    ok: jobs.every((j) => j.noPrazo) && noticias.noPrazo,
    verificadoEm: agora.toISOString(),
    jobs,
    noticias,
  };
}

export async function configSaude(): Promise<ConfigSaude> {
  return parseYaml(await readFile(join(configDir(), "saude.yaml"), "utf8")) as ConfigSaude;
}

export async function leSaude(config: ConfigSaude): Promise<Leitura> {
  const sb = client();
  const ultimaExecucao: Leitura["ultimaExecucao"] = {};
  await Promise.all(
    Object.keys(config.jobs).map(async (job) => {
      const { data, error } = await sb
        .from("execucoes")
        .select("terminado_em, ok")
        .eq("job", job)
        .order("terminado_em", { ascending: false })
        .limit(1);
      if (error) throw new Error(`execucoes: ${error.message}`);
      const linha = data?.[0];
      ultimaExecucao[job] = linha ? { terminadoEm: linha.terminado_em, ok: linha.ok } : null;
    }),
  );
  const { data, error } = await sb
    .from("news_articles")
    .select("publicado_em")
    .order("publicado_em", { ascending: false })
    .limit(1);
  if (error) throw new Error(`news_articles: ${error.message}`);
  return { ultimaExecucao, noticiaMaisRecente: data?.[0]?.publicado_em ?? null };
}
