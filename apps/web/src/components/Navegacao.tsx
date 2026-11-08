"use client";

// Navegação do cabeçalho (DESIGN.md, "top-nav"). Desktop: uma linha com os links diretos
// (`menu: barra` em config/temas.yaml), o painel "Temas" e o menu "Ferramentas". Celular:
// a marca e o botão Menu, que abre tudo numa lista só. O sublinhado azul-tinta desliza até
// a entrada aberta, e o conteúdo da página desliza para o lado do destino (tema à direita
// na ordem de config/temas.yaml entra pela direita).
// Painéis fecham ao escolher, ao trocar de página, ao clicar fora e com Esc.

import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./navegacao.module.scss";

export type ItemNav = { href: string; rotulo: string; resumo?: string };

type Painel = "temas" | "ferramentas" | "menu" | null;

type Props = {
  /** Links diretos da barra, antes e depois do botão Temas. */
  antes: ItemNav[];
  depois: ItemNav[];
  temas: ItemNav[];
  ferramentas: ItemNav[];
  metodologia: ItemNav;
  /** hrefs na ordem de config/temas.yaml, com "/" no início: dá o lado da transição. */
  ordem: string[];
};

function abre(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navegacao({ antes, depois, temas, ferramentas, metodologia, ordem }: Props) {
  const pathname = usePathname();
  const [painel, setPainel] = useState<Painel>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const atual = ordem.findIndex((h) => abre(pathname, h));
  const lado = (href: string) => {
    const j = ordem.indexOf(href);
    return atual < 0 || j < 0 || j === atual ? [] : [j > atual ? "tema-avanca" : "tema-volta"];
  };
  const emTema = temas.some((t) => abre(pathname, t.href));
  const emFerramenta = ferramentas.some((t) => abre(pathname, t.href));

  // Fecha ao trocar de página (o link já fecha, mas o voltar do navegador também conta).
  const [ultimo, setUltimo] = useState(pathname);
  if (ultimo !== pathname) {
    setUltimo(pathname);
    setPainel(null);
  }

  useEffect(() => {
    if (!painel) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setPainel(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      caixa.current?.querySelector<HTMLElement>(`[aria-controls="painel-${painel}"]`)?.focus();
      setPainel(null);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    // Menu do celular ocupa a tela: a página atrás não rola.
    if (painel === "menu") document.documentElement.dataset.menuAberto = "";
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
      delete document.documentElement.dataset.menuAberto;
    };
  }, [painel]);

  const alterna = (p: Exclude<Painel, null>) => setPainel((a) => (a === p ? null : p));
  const fecha = () => setPainel(null);

  const sublinhado = (
    <motion.span
      layoutId="nav-ativo"
      className={styles.sublinhado}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    />
  );

  const linkBarra = (it: ItemNav) => {
    const on = abre(pathname, it.href);
    return (
      <li key={it.href}>
        <Link
          href={it.href}
          transitionTypes={lado(it.href)}
          aria-current={on ? "page" : undefined}
          className={on ? styles.on : undefined}
          onClick={fecha}
        >
          {it.rotulo}
          {on ? sublinhado : null}
        </Link>
      </li>
    );
  };

  const cartao = (it: ItemNav) => {
    const on = abre(pathname, it.href);
    return (
      <li key={it.href}>
        <Link
          href={it.href}
          transitionTypes={lado(it.href)}
          aria-current={on ? "page" : undefined}
          className={styles.cartao}
          onClick={fecha}
        >
          <strong>{it.rotulo}</strong>
          {it.resumo ? <span>{it.resumo}</span> : null}
        </Link>
      </li>
    );
  };

  const botao = (p: "temas" | "ferramentas", rotulo: string, on: boolean) => (
    <li>
      <button
        type="button"
        aria-expanded={painel === p}
        aria-controls={`painel-${p}`}
        className={on ? styles.on : undefined}
        onClick={() => alterna(p)}
      >
        {rotulo} <span aria-hidden="true" className={styles.seta} />
        {on ? sublinhado : null}
      </button>
    </li>
  );

  return (
    <div ref={caixa} className={styles.nav}>
      <nav aria-label="Principal" className={styles.barra}>
        <LayoutGroup id="nav">
          <ul>
            {antes.map(linkBarra)}
            {botao("temas", "Temas", emTema)}
            {depois.map(linkBarra)}
            {botao("ferramentas", "Ferramentas", emFerramenta)}
          </ul>
        </LayoutGroup>
      </nav>

      {painel === "temas" ? (
        <div id="painel-temas" className={styles.painel}>
          <ul className={`container ${styles.grade}`}>
            {temas.map(cartao)}
            {cartao(metodologia)}
          </ul>
        </div>
      ) : null}
      {painel === "ferramentas" ? (
        <div id="painel-ferramentas" className={styles.painel}>
          <ul className={`container ${styles.grade}`}>{ferramentas.map(cartao)}</ul>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.botaoMenu}
        aria-expanded={painel === "menu"}
        aria-controls="painel-menu"
        onClick={() => alterna("menu")}
      >
        <span aria-hidden="true" className={styles.icone} data-aberto={painel === "menu" || undefined} />
        {painel === "menu" ? "Fechar" : "Menu"}
      </button>
      {painel === "menu" ? (
        <nav id="painel-menu" aria-label="Menu" className={styles.menu}>
          <div className="container">
            <ul className={styles.lista}>{[{ href: "/", rotulo: "Início" }, ...antes, ...depois].map(cartao)}</ul>
            <h2>Temas</h2>
            <ul className={styles.lista}>{temas.map(cartao)}</ul>
            <h2>Ferramentas</h2>
            <ul className={styles.lista}>{[...ferramentas, metodologia].map(cartao)}</ul>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
