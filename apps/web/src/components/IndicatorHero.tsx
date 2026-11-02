// Topo da página de indicador (indicator-card do DESIGN.md, versão completa).
// De cima para baixo: rótulo e chip; valor; base do valor real (se monetário);
// variação na janela padrão; frase do template; source-line; próxima divulgação.

import type { IndicatorView } from "@/lib/data";
import { formatDate, formatRef } from "@/lib/format";
import { present } from "@/lib/present";
import { frase } from "@/lib/template";
import { FrequencyChip } from "./FrequencyChip";
import { SourceLine } from "./SourceLine";
import styles from "./ui.module.scss";

export function IndicatorHero({ view }: { view: IndicatorView }) {
  const { indicator, exibida, atraso, proxima, atualizadoEm, template } = view;
  const { series, source, obs } = exibida;
  const p = present(view);
  const texto = frase(indicator.frase_template, template, {
    refDate: p.latest.refDate,
    value: p.latest.value,
    unidade: series.unidade,
    casas: indicator.casas_decimais,
    frequencia: series.frequencia,
    obs,
  });
  return (
    <section className={styles.hero}>
      <div className={styles.cardHeader}>
        <h1 className={styles.heroLabel}>{indicator.titulo}</h1>
        <FrequencyChip frequencia={series.frequencia} atraso={atraso} />
      </div>
      <p className={styles.value}>
        {p.fmt(p.latest.value)}
        <span className="visually-hidden"> em {formatRef(p.latest.refDate, series.frequencia)}</span>
      </p>
      {p.baseReal ? <p className={styles.caption}>{p.baseReal}</p> : null}
      {p.variacao ? <p className={styles.variation}>{p.variacao}</p> : null}
      <p className={styles.phrase}>{texto}</p>
      <SourceLine source={source} series={series} refDate={p.latest.refDate} atualizadoEm={atualizadoEm} />
      <p className={styles.caption}>
        {proxima?.proximaDivulgacao
          ? `Próxima divulgação: ${formatDate(proxima.proximaDivulgacao)} (ref. ${formatRef(proxima.refDate, view.principal.series.frequencia)}), segundo o calendário do ${view.principal.source.orgao}.`
          : series.frequencia === "diaria"
            ? "Divulgação diária, nos dias úteis."
            : "Próxima divulgação: sem data no calendário coletado da fonte."}
      </p>
    </section>
  );
}
