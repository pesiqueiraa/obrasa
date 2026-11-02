// O número oficial de que as matérias do tema falam, no cabeçalho da seção de notícias.

import Link from "next/link";
import type { IndicatorView } from "@/lib/data";
import { present } from "@/lib/present";
import { SourceLine } from "../SourceLine";
import styles from "./noticias.module.scss";

export function MiniIndicador({ view }: { view: IndicatorView }) {
  const p = present(view);
  const { indicator, exibida } = view;
  return (
    <div className={styles.mini}>
      <p className={styles.miniValor}>{p.fmt(p.latest.value)}</p>
      <div>
        <p className={styles.miniRotulo}>
          <Link href={`/indicador/${indicator.slug}`}>{indicator.titulo}</Link>
        </p>
        <SourceLine source={exibida.source} series={exibida.series} refDate={p.latest.refDate} atualizadoEm={null} curta />
      </div>
    </div>
  );
}
