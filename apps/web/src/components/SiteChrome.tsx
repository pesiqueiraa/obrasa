import Link from "next/link";
import styles from "./ui.module.scss";

export function SiteHeader() {
  return (
    <header className={styles.topNav}>
      <div className="container">
        {/* Nome provisório em texto, Plex Sans 600, até a decisão D1 (docs/08). */}
        <Link href="/" className={styles.brand}>
          Brasilado
        </Link>
        <nav aria-label="Principal" className={styles.navLinks}>
          <Link href="/metodologia">Metodologia</Link>
        </nav>
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
