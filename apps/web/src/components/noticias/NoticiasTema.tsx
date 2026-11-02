// Bloco de notícias no fim de cada página de tema: até quatro matérias com foto e,
// abaixo, mais algumas só com título. No máximo duas por veículo.

import Link from "next/link";
import { equilibra, getNoticias } from "@/lib/noticias";
import { Cartao, divide, Linha } from "./Cartoes";
import styles from "./noticias.module.scss";

export async function NoticiasTema({ tema, titulo }: { tema: string; titulo: string }) {
  const lista = equilibra(
    (await getNoticias()).filter((n) => n.temas.includes(tema)),
    10,
  );
  if (lista.length === 0) return null;
  const { fotos, linhas } = divide(lista, 4, 4);
  return (
    <section className={styles.blocoTema} aria-labelledby={`noticias-${tema}`}>
      <div className={styles.blocoCabeca}>
        <h2 id={`noticias-${tema}`} className={styles.blocoTitulo}>
          Notícias sobre {titulo.toLocaleLowerCase("pt-BR")}
        </h2>
        <Link href={`/noticias#${tema}`} className={`toque ${styles.mais}`}>
          Ver todas as notícias
        </Link>
      </div>
      {fotos.length ? (
        <div className={styles.grade}>
          {fotos.map((n) => (
            <Cartao key={n.url} n={n} />
          ))}
        </div>
      ) : null}
      {linhas.length ? (
        <ul className={styles.linhas}>
          {linhas.map((n) => (
            <Linha key={n.url} n={n} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
