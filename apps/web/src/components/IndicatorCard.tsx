// indicator-card (DESIGN.md). De cima para baixo: rótulo e frequency-chip; valor com
// unidade; variação na janela padrão (seta e texto, sem cor); frase do template;
// source-line; próxima divulgação. Com `href`, o título é o link e a área dele cobre
// o cartão inteiro (::after). Não se aninha <a> em <a>: o link da fonte fica por cima.

import Link from "next/link";
import type { IndicatorView } from "@/lib/data";
import { formatDate, formatValue, monthShort } from "@/lib/format";
import { JANELAS, sliceWindow, variation, variationText } from "@/lib/indicator";
import { frase } from "@/lib/template";
import { FrequencyChip } from "./FrequencyChip";
import { SourceLine } from "./SourceLine";
import styles from "./ui.module.scss";

export function IndicatorCard({ view, href, headingLevel = 2 }: { view: IndicatorView; href?: string; headingLevel?: 1 | 2 }) {
  const { indicator, exibida, atraso, proxima, atualizadoEm, template } = view;
  const { series, source, obs } = exibida;
  const latest = obs[obs.length - 1];
  const janela = JANELAS.find((j) => j.id === indicator.janela_padrao)!;
  const v = variation(sliceWindow(obs, janela.id), series.tipo);
  const Heading = headingLevel === 1 ? "h1" : "h2";

  const body = (
    <>
      <div className={styles.cardHeader}>
        <Heading className={styles.label}>
          {href ? (
            <Link href={href} className={styles.cardLink}>
              {indicator.titulo}
            </Link>
          ) : (
            indicator.titulo
          )}
        </Heading>
        <FrequencyChip frequencia={series.frequencia} atraso={atraso} />
      </div>
      <p className={styles.value}>
        {formatValue(latest.value, series.unidade)}
        <span className="visually-hidden"> em {monthShort(latest.refDate)}</span>
      </p>
      {v ? (
        <p className={styles.variation}>{variationText(v, janela.rotulo, (n) => formatValue(n, series.unidade))}</p>
      ) : null}
      <p className={styles.phrase}>{frase(indicator.frase_template, template, latest.refDate, latest.value)}</p>
      <SourceLine source={source} series={series} refDate={latest.refDate} atualizadoEm={atualizadoEm} />
      <p className={styles.caption}>
        {proxima?.proximaDivulgacao
          ? `Próxima divulgação: ${formatDate(proxima.proximaDivulgacao)} (ref. ${monthShort(proxima.refDate)}), segundo o calendário do ${view.principal.source.orgao}.`
          : "Próxima divulgação: a fonte não publicou data."}
      </p>
    </>
  );

  if (href) return <article className={`${styles.card} ${styles.cardLinked}`}>{body}</article>;
  return <section className={styles.card}>{body}</section>;
}
