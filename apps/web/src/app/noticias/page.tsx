// Notícias por tema (docs/04, F5; DESIGN.md, módulo de notícias). Uma seção por tema:
// à esquerda, o número oficial de que as matérias falam; à direita, as matérias dos
// últimos 7 dias, no máximo duas por veículo. Regra 7: só título, link, veículo, data e
// trecho curto. Critério de inclusão dos veículos e regra de temas publicados no fim.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MiniIndicador } from "@/components/noticias/MiniIndicador";
import { NoticiaLinha } from "@/components/noticias/NoticiaLinha";
import styles from "@/components/noticias/noticias.module.scss";
import tema from "@/components/tema.module.scss";
import { getTemas, getTemaViews } from "@/lib/data";
import { equilibra, getNoticias, getVeiculos } from "@/lib/noticias";

export const metadata: Metadata = {
  title: "Notícias",
  description: "Notícias dos últimos 7 dias por tema, de veículos nacionais, ao lado do número oficial de cada tema.",
};

async function Conteudo() {
  const [temas, noticias, veiculos] = await Promise.all([getTemas(), getNoticias(), getVeiculos()]);
  const comNoticias = temas.filter((t) => t.slug !== "noticias" && noticias.some((n) => n.temas.includes(t.slug)));
  const secoes = await Promise.all(
    comNoticias.map(async (t) => {
      const doTema = noticias.filter((n) => n.temas.includes(t.slug));
      const views = await getTemaViews(t.slug);
      return { t, doTema, lista: equilibra(doTema, 8), view: views[0] };
    }),
  );

  return (
    <>
      <div className="container section">
        <header className={tema.cabecalho}>
          <h1>Notícias</h1>
          <p>
            O que os veículos publicaram nos últimos 7 dias sobre cada tema, ao lado do número oficial. Cada título leva
            ao site do veículo.
          </p>
        </header>
        <nav aria-label="Temas" className={styles.indice}>
          {secoes.map(({ t }) => (
            <a key={t.slug} href={`#${t.slug}`}>
              {t.titulo}
            </a>
          ))}
        </nav>
      </div>

      <div className="container">
        {secoes.length === 0 ? <p>Nenhuma notícia coletada nos últimos 7 dias.</p> : null}
        {secoes.map(({ t, doTema, lista, view }) => {
          const nVeiculos = new Set(doTema.map((n) => n.veiculo)).size;
          return (
            <section key={t.slug} id={t.slug} className={styles.secao} aria-labelledby={`h-${t.slug}`}>
              <div className={styles.lado}>
                <h2 id={`h-${t.slug}`} className={styles.secaoTitulo}>
                  <Link href={`/${t.slug}`}>{t.titulo}</Link>
                </h2>
                <p className={styles.secaoConta}>
                  {doTema.length} {doTema.length === 1 ? "notícia" : "notícias"} de {nVeiculos}{" "}
                  {nVeiculos === 1 ? "veículo" : "veículos"} em 7 dias; aqui, as {lista.length} mais recentes, no
                  máximo duas por veículo.
                </p>
                {view ? <MiniIndicador view={view} /> : null}
              </div>
              <ul className={styles.lista}>
                {lista.map((n) => (
                  <NoticiaLinha key={n.url} n={n} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="section section--surface">
        <div className="container">
          <section className={styles.criterio} aria-labelledby="criterio">
            <h2 id="criterio" className={styles.blocoTitulo}>
              Como as notícias entram aqui
            </h2>
            <p>
              Veículos de alcance nacional, em português, que publicam notícias de política, economia ou serviço público
              do Brasil e oferecem feed RSS público permitido pelo robots.txt. Não damos nota nem rótulo de viés a
              nenhum veículo. Colunas e artigos de opinião ficam de fora, assim como notícias de outros países.
            </p>
            <p>
              O tema de cada notícia sai de uma lista pública de termos procurados no título e no trecho, sem uso de
              inteligência artificial. Guardamos só título, link, veículo, data e um trecho de até 200 caracteres da
              descrição do feed; o texto da matéria fica no site do veículo.
            </p>
            <p className={styles.veiculos}>
              {veiculos.map((v) => (
                <span key={v.id}>{v.nome}</span>
              ))}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

export default function NoticiasPage() {
  return (
    <Suspense fallback={<div className="container section">Carregando notícias…</div>}>
      <Conteudo />
    </Suspense>
  );
}
