import Link from "next/link";
import { getTemas } from "@/lib/data";
import { CabecalhoRecolhe } from "./CabecalhoRecolhe";
import { Logo } from "./Logo";
import { Navegacao, type ItemNav } from "./Navegacao";
import styles from "./ui.module.scss";

const FERRAMENTAS: ItemNav[] = [
  {
    href: "/calculadora",
    rotulo: "Calculadora da inflação",
    resumo: "Quanto um valor em reais de um mês equivale em outro mês, pelo IPCA do IBGE.",
  },
  {
    href: "/comparar",
    rotulo: "Comparar datas",
    resumo: "Inflação, juros, desemprego, dívida e educação em duas datas, lado a lado.",
  },
  {
    href: "/agenda",
    rotulo: "Agenda",
    resumo: "Quando saem os próximos dados de inflação, emprego, PIB e as decisões do Copom.",
  },
];

const METODOLOGIA: ItemNav = {
  href: "/metodologia",
  rotulo: "Metodologia",
  resumo: "De onde vem cada número e como ele é conferido.",
};

export async function SiteHeader() {
  const temas = await getTemas();
  const item = (t: (typeof temas)[number]): ItemNav => ({ href: `/${t.slug}`, rotulo: t.titulo, resumo: t.resumo });
  const dados = temas.filter((t) => t.menu !== "barra");
  const primeiro = dados[0]?.ordem ?? Infinity;
  const barra = temas.filter((t) => t.menu === "barra");
  return (
    <CabecalhoRecolhe>
      <div className={`container ${styles.topNavInner}`}>
        <Link href="/" className={styles.brand} aria-label="oBrasa, página inicial">
          <Logo />
        </Link>
        <Navegacao
          antes={barra.filter((t) => t.ordem < primeiro).map(item)}
          depois={barra.filter((t) => t.ordem >= primeiro).map(item)}
          temas={dados.map(item)}
          ferramentas={FERRAMENTAS}
          metodologia={METODOLOGIA}
          ordem={["/", ...temas.map((t) => `/${t.slug}`)]}
        />
      </div>
    </CabecalhoRecolhe>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <Logo className={styles.footerLogo} />
        <ul>
          <li>
            <Link href="/metodologia">Metodologia</Link>
          </li>
          <li>
            <Link href="/calculadora">Calculadora da inflação</Link>
          </li>
          <li>
            <Link href="/comparar">Comparar datas</Link>
          </li>
          <li>
            <Link href="/agenda">Agenda</Link>
          </li>
          <li>
            <Link href="/correcoes">Correções</Link>
          </li>
          <li>
            <Link href="/reportar-erro">Reportar erro</Link>
          </li>
          <li>
            <Link href="/privacidade">Privacidade</Link>
          </li>
        </ul>
        <p>Dados oficiais do Brasil, com contexto e sem lado. Todo número traz a fonte, a data e a frequência.</p>
      </div>
    </footer>
  );
}
