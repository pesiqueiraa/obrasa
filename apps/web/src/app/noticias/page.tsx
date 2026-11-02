// Notícias por tema (docs/04, F5; DESIGN.md, módulo de notícias). No topo, as matérias
// mais recentes com foto, uma por veículo. Depois, uma seção por tema: o número oficial
// do tema, uma grade de matérias com foto e uma lista das demais. No máximo duas por
// veículo em cada tema. Regra 7: título, link, veículo, data, trecho curto e a imagem
// que o feed oferece, exibida do site do veículo. Critério de inclusão no fim.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Cartao, divide, Linha, Manchete } from "@/components/noticias/Cartoes";
import { MiniIndicador } from "@/components/noticias/MiniIndicador";
import styles from "@/components/noticias/noticias.module.scss";
import { getTemas, getTemaViews } from "@/lib/data";
import { equilibra, getNoticias, getVeiculos } from "@/lib/noticias";

export const metadata: Metadata = {
  title: "Notícias",
  description: "Notícias dos últimos 7 dias por tema, de 16 veículos nacionais, ao lado do número oficial de cada tema.",
};

async function Conteudo() {
  const [temas, noticias, veiculos] = await Promise.all([getTemas(), getNoticias(), getVeiculos()]);
  const topo = equilibra(
    noticias.filter((n) => n.imagem),
    4,
    1,
  );
  const noTopo = new Set(topo.map((n) => n.url));
  const secoes = (
    await Promise.all(
      temas
        .filter((t) => t.slug !== "noticias")
        .map(async (t) => {
          const doTema = noticias.filter((n) => n.temas.includes(t.slug));
          const lista = equilibra(
            doTema.filter((n) => !noTopo.has(n.url)),
            12,
          );
          const views = lista.length ? await getTemaViews(t.slug) : [];
          return { t, total: doTema.length, ...divide(lista, 3, 6), view: views[0] };
        }),
    )
  ).filter((s) => s.fotos.length + s.linhas.length > 0);
  const [lider, ...lado] = topo;

  return (
    <>
      <div className="container section">
        <header className={styles.cabeca}>
          <h1 className={styles.h1}>Notícias</h1>
          <p>O que 16 veículos publicaram nos últimos 7 dias, separado por tema.</p>
        </header>
        <nav aria-label="Temas" className={styles.indice}>
          {secoes.map(({ t, total }) => (
            <a key={t.slug} href={`#${t.slug}`}>
              {t.titulo} <span>{total}</span>
            </a>
          ))}
        </nav>

        {lider ? (
          <section className={styles.topo} aria-label="Mais recentes">
            <Manchete n={lider} />
            <div className={styles.topoLado}>
              {lado.map((n) => (
                <Cartao key={n.url} n={n} lado />
              ))}
            </div>
          </section>
        ) : (
          <p>Nenhuma notícia coletada nos últimos 7 dias.</p>
        )}
      </div>

      <div className="container">
        {secoes.map(({ t, fotos, linhas, view }) => (
          <section key={t.slug} id={t.slug} className={styles.secao} aria-labelledby={`h-${t.slug}`}>
            <div className={styles.secaoCabeca}>
              <h2 id={`h-${t.slug}`} className={styles.secaoTitulo}>
                <Link href={`/${t.slug}`}>{t.titulo}</Link>
              </h2>
              {view ? <MiniIndicador view={view} /> : null}
            </div>
            <div
              className={`${styles.secaoCorpo} ${fotos.length === 1 && linhas.length ? styles.secaoCorpoUma : ""}`}
            >
              {fotos.length ? (
                <div className={styles.gradeSecao}>
                  {fotos.map((n) => (
                    <Cartao key={n.url} n={n} />
                  ))}
                </div>
              ) : null}
              {linhas.length ? (
                <ul className={styles.linhas}>
                  {linhas.map((n) => (
                    <Linha key={n.url} n={n} />
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
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
              nenhum veículo. Colunas, artigos de opinião e notícias de outros países ficam de fora.
            </p>
            <p>
              O tema de cada notícia sai de uma lista pública de termos procurados no título e no trecho, sem uso de
              inteligência artificial. Guardamos título, link, veículo, data, um trecho de até 200 caracteres e o
              endereço da imagem que o próprio feed indica. A imagem é carregada do site do veículo; o texto da matéria
              fica lá.
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
