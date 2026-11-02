// Peças do módulo de notícias (DESIGN.md). Toda manchete leva ao site do veículo.
// Regra 7: título, link, veículo, data, trecho curto e a imagem que o feed oferece.

import { quando, type Noticia } from "@/lib/noticias";
import { Foto } from "./Foto";
import styles from "./noticias.module.scss";

function Meta({ n }: { n: Noticia }) {
  return (
    <p className={styles.meta}>
      <span className={styles.veiculo}>{n.veiculo}</span>
      <time dateTime={n.publicadoEm}>{quando(n.publicadoEm)}</time>
    </p>
  );
}

/** Matéria principal: foto grande, manchete grande e trecho. */
export function Manchete({ n }: { n: Noticia }) {
  return (
    <article className={styles.manchete}>
      <a href={n.url} rel="noopener" className={styles.cartaoLink}>
        {n.imagem ? <Foto src={n.imagem} className={styles.fotoGrande} /> : null}
        <div className={styles.mancheteTexto}>
          <Meta n={n} />
          <h3 className={styles.mancheteTitulo}>{n.titulo}</h3>
          {n.trecho ? <p className={styles.trecho}>{n.trecho}</p> : null}
        </div>
      </a>
    </article>
  );
}

/** Cartão com foto em cima (grade) ou ao lado (`lado`). */
export function Cartao({ n, lado = false }: { n: Noticia; lado?: boolean }) {
  return (
    <article className={lado ? styles.cartaoLado : styles.cartao}>
      <a href={n.url} rel="noopener" className={styles.cartaoLink}>
        {n.imagem ? <Foto src={n.imagem} /> : null}
        <div>
          <Meta n={n} />
          <h3 className={styles.titulo}>{n.titulo}</h3>
        </div>
      </a>
    </article>
  );
}

/** Linha só de texto, para as matérias sem foto ou além da grade. */
export function Linha({ n }: { n: Noticia }) {
  return (
    <li className={styles.linha}>
      <a href={n.url} rel="noopener" className={styles.cartaoLink}>
        <Meta n={n} />
        <span className={styles.tituloLinha}>{n.titulo}</span>
      </a>
    </li>
  );
}

/** Separa a lista em até `nFotos` matérias com foto (grade) e o resto (linhas). */
export function divide(lista: Noticia[], nFotos: number, nLinhas: number) {
  const fotos = lista.filter((n) => n.imagem).slice(0, nFotos);
  const usadas = new Set(fotos.map((n) => n.url));
  return { fotos, linhas: lista.filter((n) => !usadas.has(n.url)).slice(0, nLinhas) };
}
