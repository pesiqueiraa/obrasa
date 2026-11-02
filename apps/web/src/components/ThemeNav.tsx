"use client";

// Navegação por temas (DESIGN.md, "theme-nav"). O sublinhado azul-tinta desliza até o
// tema aberto, e o conteúdo da página desliza para o lado do tema escolhido (à direita
// na lista, entra pela direita): o movimento mostra para onde a pessoa foi.

import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./ui.module.scss";

export type NavItem = { href: string; rotulo: string };

export function ThemeNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const ativo = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const atual = items.findIndex((it) => ativo(it.href));
  return (
    <nav aria-label="Temas" className={styles.themeNav}>
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
