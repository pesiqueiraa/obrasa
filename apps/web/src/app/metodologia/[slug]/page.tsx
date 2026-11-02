// Página de metodologia do indicador (docs/02, princípio 6): fonte, série,
// transformações aplicadas e fórmula, revisões e correções.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { seriesDescriptor } from "@/components/SourceLine";
import { getCorrections, getIndicatorView, getRevisions, listIndicatorSlugs, type SeriesBundle } from "@/lib/data";
import { formatDate, formatNumber, monthShort } from "@/lib/format";
import { FREQUENCIA_ROTULO, JANELAS } from "@/lib/indicator";

export async function generateStaticParams() {
  const slugs = await listIndicatorSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/metodologia/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const view = await getIndicatorView(slug);
  return { title: view ? `Metodologia: ${view.indicator.titulo}` : "Metodologia" };
}

function SeriesFacts({ bundle, papel }: { bundle: SeriesBundle; papel: string }) {
  const { series, source, obs } = bundle;
  const primeiraColeta = obs.reduce((a, o) => (o.collectedAt < a ? o.collectedAt : a), obs[0]?.collectedAt ?? "");
  return (
    <>
      <h2>{papel}</h2>
      <table className="simple-table">
        <tbody>
          <tr>
            <th scope="row">Órgão</th>
            <td>{source.orgao}</td>
          </tr>
          <tr>
            <th scope="row">Série</th>
            <td>
              {series.nome} ({seriesDescriptor(source, series)})
            </td>
          </tr>
          <tr>
            <th scope="row">Identificador no Brasilado</th>
            <td>
              <code>{series.id}</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Unidade e frequência</th>
            <td>
              {series.unidade}, {FREQUENCIA_ROTULO[series.frequencia].toLowerCase()}
            </td>
          </tr>
          <tr>
            <th scope="row">Períodos no banco</th>
            <td>
              {obs.length > 0
                ? `${monthShort(obs[0].refDate)} a ${monthShort(obs[obs.length - 1].refDate)} (${obs.length} meses)`
                : "nenhum"}
            </td>
          </tr>
          <tr>
            <th scope="row">Primeira coleta registrada</th>
            <td>{primeiraColeta ? formatDate(primeiraColeta) : "nenhuma"}</td>
          </tr>
          <tr>
            <th scope="row">Dado na fonte</th>
            <td>{source.url_fonte ? <a href={source.url_fonte}>{source.url_fonte}</a> : "sem link"}</td>
          </tr>
          {source.url_documentacao ? (
            <tr>
              <th scope="row">Documentação da API</th>
              <td>
                <a href={source.url_documentacao}>{source.url_documentacao}</a>
              </td>
            </tr>
          ) : null}
          {source.url_metodologia ? (
            <tr>
              <th scope="row">Metodologia da fonte</th>
              <td>
                <a href={source.url_metodologia}>{source.url_metodologia}</a>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {series.nota_metodologia ? <p>{series.nota_metodologia}</p> : null}
    </>
  );
}

async function MethodologyContent({ params }: Pick<PageProps<"/metodologia/[slug]">, "params">) {
  const { slug } = await params;
  const view = await getIndicatorView(slug);
  if (!view) notFound();
  const { indicator, principal, reserva, exibida } = view;
  const [revisoes, correcoes] = await Promise.all([getRevisions(exibida.series.id), getCorrections(slug)]);
  const latest = exibida.obs[exibida.obs.length - 1];
  const janelaPadrao = JANELAS.find((j) => j.id === indicator.janela_padrao)!;

  return (
    <div className="container section">
      <div className="prose">
        <p>
          <Link href={`/indicador/${indicator.slug}`}>← {indicator.titulo}</Link>
        </p>
        <h1 className="display">Metodologia: {indicator.titulo}</h1>
        <p className="body-lg">
          O número exibido é o acumulado em 12 meses publicado pelo {principal.source.orgao}. O Brasilado não calcula
          nem estima esse valor: guarda a resposta da fonte, confere e mostra.
        </p>

        <SeriesFacts bundle={principal} papel="Fonte principal" />
        {reserva ? (
          <>
            <SeriesFacts bundle={reserva} papel="Fonte reserva" />
            <p>
              A fonte reserva só aparece na tela quando tem um mês mais recente que a principal. Nesse caso a página
              avisa e a linha de fonte passa a citar o órgão reserva.
            </p>
          </>
        ) : null}

        <h2>Transformações</h2>
        <p>
          Nenhuma. O valor exibido é o publicado pela fonte, sem arredondamento adicional. Os valores ficam guardados
          como <code>numeric</code> no banco, nunca como ponto flutuante.
        </p>

        <h2>Conferência a cada coleta</h2>
        <p>
          A cada coleta, o acumulado publicado é comparado com o acumulado calculado a partir da variação mensal
          (IBGE, tabela 1737, variável 63). Variações percentuais não se somam: o acumulado é encadeado.
        </p>
        <p>
          <code>acumulado em 12 meses = [(1 + v₁/100) × (1 + v₂/100) × … × (1 + v₁₂/100) − 1] × 100</code>
        </p>
        <p>
          A variação mensal é publicada com duas casas decimais, e o IBGE calcula o acumulado a partir do
          número-índice. Por isso o valor encadeado pode diferir do publicado só pelo arredondamento: até 0,066 p.p.
          mais 0,061% do valor publicado. Se a diferença passar disso, ou se a série tiver um mês faltando, a coleta é
          recusada, nada é gravado e a equipe recebe um alerta. A série do Banco Central também é comparada com a do
          IBGE, mês a mês.
        </p>

        <h2>O que significa para você</h2>
        <p>
          A frase sob o número vem de um modelo de texto versionado no repositório (
          <code>config/templates/{indicator.frase_template}</code>), nunca de inteligência artificial. O valor em reais
          é <code>R$ 100,00 × (1 + acumulado/100)</code>, com o acumulado do mês de referência.
        </p>

        <h2>Janelas e variação</h2>
        <p>
          O gráfico tem as janelas padrão de toda a plataforma: {JANELAS.map((j) => j.rotulo).join(", ")}. A janela de
          N meses vai do mesmo mês N meses antes do último dado até o último dado. A variação do cartão usa a janela de{" "}
          {janelaPadrao.rotulo} e é a diferença, em pontos percentuais, entre o último valor e o primeiro da janela.
        </p>

        <h2>Datas e atraso</h2>
        <p>
          &quot;Atualizado em&quot; é a data em que a fonte publicou ou alterou o período exibido. A próxima divulgação
          vem do calendário oficial do {principal.source.orgao}. Se essa data passa e o período novo não chega ao banco,
          o chip de frequência muda para &quot;Atrasado desde dd/mm&quot; e a página continua mostrando o último dado
          válido, com a data dele.
        </p>

        <h2>Rastreabilidade</h2>
        <p>
          Cada valor guarda o caminho da resposta bruta da fonte, com data da coleta e hash SHA-256. O valor de{" "}
          {monthShort(latest.refDate)} veio de <code>{latest.rawObject}</code>, coletado em{" "}
          {formatDate(latest.collectedAt)}. O CSV do indicador traz esse caminho em cada linha.
        </p>

        <h2>Revisões da fonte</h2>
        {revisoes.length === 0 ? (
          <p>Nenhuma revisão registrada para esta série desde o início da coleta.</p>
        ) : (
          <table className="simple-table">
            <thead>
              <tr>
                <th>Mês de referência</th>
                <th>Versão</th>
                <th className="num">Valor</th>
                <th>Coletado em</th>
              </tr>
            </thead>
            <tbody>
              {revisoes.map((r) => (
                <tr key={`${r.refDate}-${r.revision}`}>
                  <td>{monthShort(r.refDate)}</td>
                  <td>{r.revision}</td>
                  <td className="num">{formatNumber(r.value)}</td>
                  <td>{formatDate(r.collectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p>Uma revisão da fonte vira uma nova versão do dado. A versão anterior nunca é apagada.</p>

        <h2>Correções</h2>
        {correcoes.length === 0 ? (
          <p>Nenhuma correção registrada para este indicador.</p>
        ) : (
          <ul>
            {correcoes.map((c) => (
              <li key={c.id}>
                {formatDate(c.data)}: {c.descricao}
                {c.antes || c.depois ? ` (antes: ${c.antes ?? "—"}; depois: ${c.depois ?? "—"})` : null}
              </li>
            ))}
          </ul>
        )}
        <p>
          Encontrou um erro? <Link href="/reportar-erro">Reporte aqui</Link>.
        </p>
      </div>
    </div>
  );
}

export default function MethodologyPage(props: PageProps<"/metodologia/[slug]">) {
  return (
    <Suspense fallback={<div className="container section">Carregando metodologia…</div>}>
      <MethodologyContent params={props.params} />
    </Suspense>
  );
}
