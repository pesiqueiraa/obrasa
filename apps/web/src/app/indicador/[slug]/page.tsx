// Página de indicador (docs/04, F0). Ordem do DESIGN.md: valor e frase → gráfico
// com abas de janela → linha de fonte → próxima divulgação → metodologia.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChartPanel, type Variante } from "@/components/ChartPanel";
import { Expectativas } from "@/components/Expectativas";
import { IndicatorHero } from "@/components/IndicatorHero";
import { SourceLine } from "@/components/SourceLine";
import styles from "@/components/ui.module.scss";
import { getIndicatorView, getTemas, listIndicatorSlugs, type SeriesBundle } from "@/lib/data";
import { formatDate, formatRef } from "@/lib/format";

export async function generateStaticParams() {
  const slugs = await listIndicatorSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/indicador/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const view = await getIndicatorView(slug);
  return { title: view?.indicator.titulo ?? "Indicador" };
}

const EIXO: Record<string, string> = {
  "%": "%",
  "% a.a.": "% ao ano",
  "% do PIB": "% do PIB",
  "R$": "reais",
  "R$/US$": "reais por dólar",
  "índice": "índice",
};

function variante(id: string, rotulo: string, b: SeriesBundle, atualizadoEm: string | null, subtitulo: string): Variante {
  const first = b.obs[0];
  const last = b.obs[b.obs.length - 1];
  const f = b.series.frequencia;
  return {
    id,
    rotulo,
    serieRotulo: b.series.nome,
    subtitulo,
    obs: b.obs.map((o) => ({ refDate: o.refDate, value: o.value })),
    sourceLine: (
      <SourceLine
        source={b.source}
        series={b.series}
        refDate={last.refDate}
        periodo={`${formatRef(first.refDate, f)} a ${formatRef(last.refDate, f)}`}
        atualizadoEm={atualizadoEm}
      />
    ),
  };
}

async function IndicatorContent({ params }: Pick<PageProps<"/indicador/[slug]">, "params">) {
  const { slug } = await params;
  const view = await getIndicatorView(slug);
  if (!view) notFound();
  const temas = await getTemas();
  const tema = temas.find((t) => t.slug === view.indicator.tema);

  const { indicator, exibida, principal, nominal, usandoReserva, atualizadoEm, correcoesRecentes } = view;
  const { series, source, obs } = exibida;
  const first = obs[0];
  const latest = obs[obs.length - 1];
  const f = series.frequencia;
  const desde = `Série desde ${formatRef(first.refDate, f)}.`;

  const variantes: Variante[] = nominal
    ? [
        variante(
          "real",
          "Real",
          exibida,
          atualizadoEm,
          `${series.nome}, em reais a preços de ${formatRef(latest.refDate, f)} (corrigido pelo IBGE). ${desde}`,
        ),
        variante(
          "nominal",
          "Nominal",
          nominal,
          atualizadoEm,
          `${nominal.series.nome}, em reais de cada período, sem correção pela inflação. ${desde}`,
        ),
      ]
    : [variante("unica", "", exibida, atualizadoEm, `${series.nome}, em ${series.unidade}. ${desde}`)];

  return (
    <>
      <div className="container section">
        {tema ? (
          <p className={styles.crumb}>
            <Link href={`/${tema.slug}`}>{tema.titulo}</Link>
          </p>
        ) : null}
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
            O dado de {formatRef(latest.refDate, f)} ainda não está disponível na fonte principal (
            {principal.source.orgao}). Mostramos a republicação do {source.orgao}, que é a fonte reserva deste
            indicador.
          </p>
        ) : null}
        <IndicatorHero view={view} />
        {indicator.focus ? <Expectativas focus={indicator.focus} casas={indicator.casas_decimais} /> : null}
      </div>

      <div className="section section--surface">
        <div className="container">
          <ChartPanel
            titulo={indicator.titulo}
            unidade={series.unidade}
            casas={indicator.casas_decimais}
            frequencia={f}
            eixo={EIXO[series.unidade] ?? series.unidade}
            variantes={variantes}
            janelaPadrao={indicator.janela_padrao}
            csvHref={`/indicador/${indicator.slug}/dados.csv`}
          />
        </div>
      </div>

      <div className="container section">
        <div className="prose">
          <h2 className="headline">Metodologia</h2>
          {indicator.transformacao === "inverter_sinal" ? (
            <p>
              O Banco Central publica esta série como necessidade de financiamento, em que o déficit aparece com sinal
              positivo. O oBrasa mostra o resultado, com o sinal trocado: valor negativo é déficit, como no Focus.
            </p>
          ) : null}
          <p>
            De onde vem o número, como ele é conferido e o histórico de revisões:{" "}
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
