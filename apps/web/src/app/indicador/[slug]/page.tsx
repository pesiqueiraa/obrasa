// Página de indicador (docs/04, F0). Ordem do DESIGN.md: valor e frase → gráfico
// com abas de janela → linha de fonte → próxima divulgação → metodologia.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChartPanel } from "@/components/ChartPanel";
import { IndicatorCard } from "@/components/IndicatorCard";
import { SourceLine } from "@/components/SourceLine";
import styles from "@/components/ui.module.scss";
import { getIndicatorView, listIndicatorSlugs } from "@/lib/data";
import { formatDate, monthShort } from "@/lib/format";

export async function generateStaticParams() {
  const slugs = await listIndicatorSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/indicador/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const view = await getIndicatorView(slug);
  return { title: view?.indicator.titulo ?? "Indicador" };
}

async function IndicatorContent({ params }: Pick<PageProps<"/indicador/[slug]">, "params">) {
  const { slug } = await params;
  const view = await getIndicatorView(slug);
  if (!view) notFound();

  const { indicator, exibida, principal, usandoReserva, atualizadoEm, correcoesRecentes } = view;
  const { series, source, obs } = exibida;
  const first = obs[0];
  const latest = obs[obs.length - 1];

  return (
    <>
      <div className="container section">
        {correcoesRecentes.length > 0 ? (
          <p className={styles.banner} role="status">
            Este indicador teve{" "}
            {correcoesRecentes.length === 1 ? "uma correção" : `${correcoesRecentes.length} correções`} nos últimos 30
            dias (a mais recente em {formatDate(correcoesRecentes[0].data)}).{" "}
            <Link href="/correcoes">Ver registro de correções</Link>.
          </p>
        ) : null}
        {usandoReserva ? (
          <p className={styles.banner} role="status">
            O dado de {monthShort(latest.refDate)} ainda não está disponível na fonte principal (
            {principal.source.orgao}). Mostramos a republicação do {source.orgao}, que é a fonte reserva deste
            indicador.
          </p>
        ) : null}
        <IndicatorCard view={view} headingLevel={1} />
      </div>

      <div className="section section--surface">
        <div className="container">
          <ChartPanel
            titulo={indicator.titulo}
            subtitulo={`${series.nome}, em ${series.unidade}, por mês de referência. Série desde ${monthShort(first.refDate)}.`}
            serieRotulo={series.nome}
            unidade={series.unidade}
            obs={obs}
            janelaPadrao={indicator.janela_padrao}
            csvHref={`/indicador/${indicator.slug}/dados.csv`}
            sourceLine={
              <SourceLine
                source={source}
                series={series}
                refDate={latest.refDate}
                periodo={`${monthShort(first.refDate)} a ${monthShort(latest.refDate)}`}
                atualizadoEm={atualizadoEm}
              />
            }
          />
        </div>
      </div>

      <div className="container section">
        <div className="prose">
          <h2 className="headline">Metodologia</h2>
          <p>
            De onde vem o número, como conferimos o valor publicado e o histórico de revisões:{" "}
            <Link href={`/metodologia/${indicator.slug}`}>metodologia deste indicador</Link>.
          </p>
        </div>
      </div>
    </>
  );
}

export default function IndicatorPage(props: PageProps<"/indicador/[slug]">) {
  return (
    <Suspense fallback={<div className="container section">Carregando indicador…</div>}>
      <IndicatorContent params={props.params} />
    </Suspense>
  );
}
