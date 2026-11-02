// news-story-row (DESIGN.md, módulo de notícias): veículo, título em Plex Serif com link
// para o site do veículo, data e trecho curto do feed (regra 7). Sem foto.

import { quando, type Noticia } from "@/lib/noticias";
import styles from "./noticias.module.scss";

export function NoticiaLinha({ n, comTrecho = true }: { n: Noticia; comTrecho?: boolean }) {
  return (
    <li className={styles.linha}>
      <p className={styles.veiculo}>
        {n.veiculo} <time dateTime={n.publicadoEm}>{quando(n.publicadoEm)}</time>
      </p>
      <h3 className={styles.titulo}>
        <a href={n.url} rel="noopener">
          {n.titulo}
        </a>
      </h3>
      {comTrecho && n.trecho ? <p className={styles.trecho}>{n.trecho}</p> : null}
    </li>
  );
}
