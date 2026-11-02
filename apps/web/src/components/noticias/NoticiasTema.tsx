// Bloco "Notícias" no fim de cada página de tema: as mais recentes do tema, no máximo
// duas por veículo, com link para a página de notícias.

import Link from "next/link";
import { equilibra, getNoticias } from "@/lib/noticias";
import { NoticiaLinha } from "./NoticiaLinha";
import styles from "./noticias.module.scss";

export async function NoticiasTema({ tema, titulo }: { tema: string; titulo: string }) {
  const lista = equilibra(
    (await getNoticias()).filter((n) => n.temas.includes(tema)),
    5,
  );
  if (lista.length === 0) return null;
  return (
    <section className={styles.blocoTema} aria-labelledby={`noticias-${tema}`}>
      <h2 id={`noticias-${tema}`} className={styles.blocoTitulo}>
        Notícias sobre {titulo.toLocaleLowerCase("pt-BR")}
      </h2>
      <p className={styles.blocoSub}>
        Últimos 7 dias, da mais recente para a mais antiga. Cada título leva ao site do veículo.
      </p>
      <ul className={styles.lista}>
        {lista.map((n) => (
          <NoticiaLinha key={n.url} n={n} comTrecho={false} />
        ))}
      </ul>
      <Link href={`/noticias#${tema}`} className={styles.mais}>
        Notícias de todos os temas
      </Link>
    </section>
  );
}
