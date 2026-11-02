// Notícias por tema (docs/04, F5; DESIGN.md, módulo de notícias), uma página por tema.
// "Agora": as mais recentes com foto, uma por veículo. Cada tema: o número oficial, uma
// grade de matérias com foto e uma lista das demais, no máximo duas por veículo. Regra 7: título, link, veículo, data, trecho curto e a imagem
// que o feed oferece, exibida do site do veículo. Critério de inclusão no fim.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Cartao, divide, Linha, Manchete } from "@/components/noticias/Cartoes";
import { MiniIndicador } from "@/components/noticias/MiniIndicador";
import { type Pagina, Paginas } from "@/components/noticias/Paginas";
import styles from "@/components/noticias/noticias.module.scss";
import { getTemas, getTemaViews } from "@/lib/data";
import { equilibra, getNoticias, getVeiculos, type Noticia } from "@/lib/noticias";

export const metadata: Metadata = {
  title: "Notícias",
  description: "Notícias dos últimos 7 dias por tema, de 16 veículos nacionais, ao lado do número oficial de cada tema.",
};

function Secao({ fotos, linhas }: { fotos: Noticia[]; linhas: Noticia[] }) {
  return (
    <div className={`${styles.secaoCorpo} ${fotos.length === 1 && linhas.length ? styles.secaoCorpoUma : ""}`}>
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
  );
}

async function Conteudo() {
  const [temas, noticias, veiculos] = await Promise.all([getTemas(), getNoticias(), getVeiculos()]);
  // Página "Agora": a mais recente com foto de cada veículo em destaque e, abaixo,
  // as seguintes de todos os temas, uma por veículo.
  const topo = equilibra(
    noticias.filter((n) => n.imagem),
    4,
    1,
  );
  const noTopo = new Set(topo.map((n) => n.url));
  const seguintes = equilibra(
    noticias.filter((n) => !noTopo.has(n.url)),
    8,
    1,
  );
  const [lider, ...lado] = topo;

  const temasComNoticia = (
    await Promise.all(
      temas
        .filter((t) => t.slug !== "noticias")
        .map(async (t) => {
          const doTema = noticias.filter((n) => n.temas.includes(t.slug));
          if (!doTema.length) return null;
          const views = await getTemaViews(t.slug);
          return { t, total: doTema.length, ...divide(equilibra(doTema, 12), 3, 6), view: views[0] };
        }),
    )
  ).filter((x) => x !== null);

  const paginas: Pagina[] = [
    {
      slug: "agora",
      titulo: "Agora",
      conta: null,
      conteudo: lider ? (
        <>
          <div className={styles.topo}>
            <Manchete n={lider} />
            <div className={styles.topoLado}>
              {lado.map((n) => (
                <Cartao key={n.url} n={n} lado />
              ))}
            </div>
          </div>
          <Secao fotos={[]} linhas={seguintes} />
        </>
      ) : (
        <p>Nenhuma notícia coletada nos últimos 7 dias.</p>
      ),
    },
    ...temasComNoticia.map(({ t, total, fotos, linhas, view }) => ({
      slug: t.slug,
      titulo: t.titulo,
      conta: total,
      conteudo: (
        <>
          <div className={styles.secaoCabeca}>
            <h2 className={styles.secaoTitulo}>
              <Link href={`/${t.slug}`}>{t.titulo}</Link>
            </h2>
            {view ? <MiniIndicador view={view} /> : null}
          </div>
          <Secao fotos={fotos} linhas={linhas} />
        </>
      ),
    })),
  ];

  return (
    <>
      <div className="container section">
        <header className={styles.cabeca}>
          <h1 className={styles.h1}>Notícias</h1>
        </header>
        <Paginas paginas={paginas} />
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
