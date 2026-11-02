// Página de tema (docs/08, D13): /economia, /trabalho, /contas-publicas.
// Cabeçalho → bloco próprio do tema → indicadores do tema.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IndicatorTile } from "@/components/IndicatorTile";
import { TemaDestaque } from "@/components/TemaDestaque";
import styles from "@/components/tema.module.scss";
import ui from "@/components/ui.module.scss";
import { getTemas, getTemaViews } from "@/lib/data";

export async function generateStaticParams() {
  const temas = await getTemas();
  return temas.map((t) => ({ tema: t.slug }));
}

export async function generateMetadata(props: PageProps<"/[tema]">): Promise<Metadata> {
  const { tema } = await props.params;
  const t = (await getTemas()).find((x) => x.slug === tema);
  return { title: t?.titulo ?? "Tema", description: t?.resumo };
}

async function TemaContent({ params }: Pick<PageProps<"/[tema]">, "params">) {
  const { tema } = await params;
  const t = (await getTemas()).find((x) => x.slug === tema);
  if (!t) notFound();
  const views = await getTemaViews(t.slug);
  return (
    <>
      <div className="container section">
        <header className={styles.cabecalho}>
          <h1>{t.titulo}</h1>
          <p>{t.resumo}</p>
        </header>
      </div>
      <div className="section section--surface">
        <div className="container">
          <TemaDestaque tema={t.slug} views={views} />
        </div>
      </div>
      <div className="container section">
        <h2 className={styles.secaoTitulo}>Indicadores</h2>
        <div className={ui.tileGrid}>
          {views.map((v, i) => (
            <IndicatorTile key={v.indicator.slug} view={v} delay={i * 0.08} />
          ))}
        </div>
      </div>
    </>
  );
}

export default function TemaPage(props: PageProps<"/[tema]">) {
  return (
    <Suspense fallback={<div className="container section">Carregando tema…</div>}>
      <TemaContent params={props.params} />
    </Suspense>
  );
}
