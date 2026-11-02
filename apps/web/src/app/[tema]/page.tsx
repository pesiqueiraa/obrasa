// Página de tema (docs/08, D13): /economia, /trabalho, /contas-publicas.
// Cabeçalho → bloco próprio do tema → indicadores do tema.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IndicatorTile } from "@/components/IndicatorTile";
import { NoticiasTema } from "@/components/noticias/NoticiasTema";
import { TemaDestaque } from "@/components/TemaDestaque";
import styles from "@/components/tema.module.scss";
import ui from "@/components/ui.module.scss";
import { getTemas, getTemaViews } from "@/lib/data";
import { MapaUf } from "@/components/MapaUf";
import { getDesenhoUf, getMapasUf } from "@/lib/regional";

export async function generateStaticParams() {
  const temas = await getTemas();
  // Temas com rota própria (ex.: /eleicoes-2026) ficam de fora desta página genérica.
  return temas.filter((t) => t.pagina !== "propria").map((t) => ({ tema: t.slug }));
}

export async function generateMetadata(props: PageProps<"/[tema]">): Promise<Metadata> {
  const { tema } = await props.params;
  const t = (await getTemas()).find((x) => x.slug === tema);
  return { title: t?.titulo ?? "Tema", description: t?.resumo };
}

async function TemaContent({ params }: Pick<PageProps<"/[tema]">, "params">) {
  const { tema } = await params;
  const t = (await getTemas()).find((x) => x.slug === tema && x.pagina !== "propria");
  if (!t) notFound();
  const [views, mapas] = await Promise.all([getTemaViews(t.slug), getMapasUf(t.slug)]);
  const desenho = mapas.length ? await getDesenhoUf() : null;
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
          {desenho ? <MapaUf mapas={mapas} desenho={desenho} /> : null}
        </div>
      </div>
      <div className="container section">
        <h2 className={styles.secaoTitulo}>Indicadores</h2>
        <div className={ui.tileGrid}>
          {views.map((v, i) => (
            <IndicatorTile key={v.indicator.slug} view={v} delay={i * 0.08} />
          ))}
        </div>
        <NoticiasTema tema={t.slug} titulo={t.titulo} />
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
