// indicator-tile (DESIGN.md): versão compacta do indicador para as páginas de tema.
// Rótulo e chip; valor e minilinha; variação na janela padrão; fonte curta. A frase
// "o que significa" fica na página do indicador, para o cartão ter menos texto.

import Link from "next/link";
import type { IndicatorView } from "@/lib/data";
import { formatRef } from "@/lib/format";
import { present } from "@/lib/present";
import { FrequencyChip } from "./FrequencyChip";
import { SourceLine } from "./SourceLine";
import { Sparkline } from "./viz/Sparkline";
import styles from "./ui.module.scss";

export function IndicatorTile({ view, delay = 0 }: { view: IndicatorView; delay?: number }) {
  const { indicator, exibida, atraso, atualizadoEm } = view;
  const p = present(view);
  return (
    <article className={`${styles.tile} ${styles.cardLinked}`}>
      <div className={styles.tileHead}>
        <h3 className={styles.label}>
          <Link href={`/indicador/${indicator.slug}`} className={styles.cardLink}>
            {indicator.titulo}
          </Link>
        </h3>
        <FrequencyChip frequencia={exibida.series.frequencia} atraso={atraso} />
      </div>
      <div className={styles.tileBody}>
        <p className={styles.tileValue}>
          {p.fmt(p.latest.value)}
          <span className="visually-hidden"> em {formatRef(p.latest.refDate, exibida.series.frequencia)}</span>
        </p>
        <Sparkline values={p.spark} delay={delay} />
      </div>
      {p.baseReal ? <p className={styles.caption}>{p.baseReal}</p> : null}
      {p.variacao ? <p className={styles.variation}>{p.variacao}</p> : null}
      <SourceLine
        source={exibida.source}
        series={exibida.series}
        refDate={p.latest.refDate}
        atualizadoEm={atualizadoEm}
        curta
      />
    </article>
  );
}
