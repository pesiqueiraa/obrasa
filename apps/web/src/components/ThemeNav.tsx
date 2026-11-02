"use client";

// Navegação por temas (DESIGN.md, "theme-nav"). O sublinhado azul-tinta desliza até o
// tema aberto, e o conteúdo da página desliza para o lado do tema escolhido (à direita
// na lista, entra pela direita): o movimento mostra para onde a pessoa foi.
// No celular a lista rola de lado: ao abrir uma página, ela rola até o tema aberto, e as
// bordas esmaecem do lado em que há mais temas escondidos.

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./ui.module.scss";

export type NavItem = { href: string; rotulo: string };

export function ThemeNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const ativo = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const atual = items.findIndex((it) => ativo(it.href));
  const nav = useRef<HTMLElement>(null);
  const reduz = useReducedMotion();
  const [bordas, setBordas] = useState({ esq: false, dir: false });

  const medeBordas = () => {
    const el = nav.current;
    if (!el) return;
    const esq = el.scrollLeft > 1;
    const dir = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setBordas((b) => (b.esq === esq && b.dir === dir ? b : { esq, dir }));
  };

  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const item = el.querySelector<HTMLElement>("[aria-current=page]");
    if (item && el.scrollWidth > el.clientWidth) {
      // o tema aberto fica no meio da faixa (ou o mais perto disso que a rolagem deixa)
      const alvo = item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2;
      el.scrollTo({ left: Math.max(0, alvo), behavior: reduz ? "auto" : "smooth" });
    }
    medeBordas();
  }, [pathname, reduz]);

  useEffect(() => {
    window.addEventListener("resize", medeBordas);
    return () => window.removeEventListener("resize", medeBordas);
  }, []);

  return (
    <nav
      aria-label="Temas"
      className={styles.themeNav}
      ref={nav}
      onScroll={medeBordas}
      data-borda-esq={bordas.esq || undefined}
      data-borda-dir={bordas.dir || undefined}
    >
      <LayoutGroup id="temas">
        <ul>
          {items.map((it, j) => {
            const on = ativo(it.href);
            const tipo = atual < 0 || j === atual ? [] : [j > atual ? "tema-avanca" : "tema-volta"];
            return (
              <li key={it.href}>
                <Link href={it.href} transitionTypes={tipo} aria-current={on ? "page" : undefined} className={on ? styles.themeOn : undefined}>
                  {it.rotulo}
                  {on ? (
                    <motion.span
                      layoutId="tema-ativo"
                      className={styles.themeUnderline}
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}
