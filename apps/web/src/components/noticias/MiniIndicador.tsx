// Cartão mínimo do indicador ao lado das notícias (docs/04, F5): o número oficial de que
// as matérias do tema falam, com a linha de fonte.

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
      <p className={styles.miniRotulo}>
        <Link href={`/indicador/${indicator.slug}`}>{indicator.titulo}</Link>
      </p>
      <p className={styles.miniValor}>{p.fmt(p.latest.value)}</p>
      <SourceLine source={exibida.source} series={exibida.series} refDate={p.latest.refDate} atualizadoEm={null} curta />
    </div>
  );
}
