import Link from "next/link";
import { getTemas } from "@/lib/data";
import { ThemeNav } from "./ThemeNav";
import styles from "./ui.module.scss";

export async function SiteHeader() {
  const temas = await getTemas();
  const items = [{ href: "/", rotulo: "Brasil hoje" }, ...temas.map((t) => ({ href: `/${t.slug}`, rotulo: t.titulo }))];
  return (
    <header className={styles.topNav}>
      <div className={`container ${styles.topNavInner}`}>
        {/* Nome provisório em texto, Plex Sans 600, até a decisão D1 (docs/08). */}
        <Link href="/" className={styles.brand}>
          oBrasa
        </Link>
        <ThemeNav items={items} />
        <Link href="/metodologia" className={styles.navAside}>
          Metodologia
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <ul>
          <li>
            <Link href="/metodologia">Metodologia</Link>
          </li>
          <li>
            <Link href="/correcoes">Correções</Link>
          </li>
          <li>
            <Link href="/quem-financia">Quem financia</Link>
          </li>
          <li>
            <Link href="/reportar-erro">Reportar erro</Link>
          </li>
        </ul>
        <p>Dados oficiais do Brasil, com contexto e sem lado. Todo número traz a fonte, a data e a frequência.</p>
      </div>
    </footer>
  );
}
