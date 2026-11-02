// Notícias por tema (docs/04, F5). Regra 7: só título, link, veículo, data e trecho curto,
// gravados por pipelines/jobs/noticias.py a partir dos feeds de config/noticias.yaml.

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { client } from "./data";

export type Noticia = {
  url: string;
  titulo: string;
  publicadoEm: string;
  trecho: string | null;
  temas: string[];
  veiculo: string;
  /** Endereço da imagem dado pelo feed do veículo; exibida de lá, nunca copiada. */
  imagem: string | null;
};

export type Veiculo = { id: string; nome: string; dominio: string };

/** Nenhum veículo ocupa mais que `porVeiculo` lugares numa lista: a ordem é a da
 *  publicação, mas um feed com 100 itens não cobre os outros. */
export function equilibra(lista: Noticia[], limite: number, porVeiculo = 2): Noticia[] {
  const conta = new Map<string, number>();
  const out: Noticia[] = [];
  for (const n of lista) {
    const k = conta.get(n.veiculo) ?? 0;
    if (k >= porVeiculo) continue;
    conta.set(n.veiculo, k + 1);
    out.push(n);
    if (out.length === limite) break;
  }
  return out;
}

export async function getNoticias(dias = 7): Promise<Noticia[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("noticias");
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await client()
    .from("news_articles")
    .select("url, titulo, publicado_em, trecho, temas, imagem, outlets(nome)")
    .gte("publicado_em", desde)
    .order("publicado_em", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`news_articles: ${error.message}`);
  return data.map((r) => ({
    url: r.url,
    titulo: r.titulo,
    publicadoEm: r.publicado_em,
    trecho: r.trecho,
    temas: r.temas,
    imagem: r.imagem,
    veiculo: (r.outlets as unknown as { nome: string } | null)?.nome ?? "",
  }));
}

export async function getVeiculos(): Promise<Veiculo[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("noticias");
  const { data, error } = await client().from("outlets").select("id, nome, dominio").order("id");
  if (error) throw new Error(`outlets: ${error.message}`);
  return data;
}

/** "02/11, 14h20", no horário de Brasília. Data absoluta: a página fica em cache. */
export function quando(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}, ${p.hour}h${p.minute}`;
}
