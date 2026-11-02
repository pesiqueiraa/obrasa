"use client";

// Menu "Ferramentas" do cabeçalho: calculadora, comparador e agenda. Fecha ao escolher,
// ao clicar fora e com Esc.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./ui.module.scss";

const ITENS = [
  { href: "/calculadora", rotulo: "Calculadora da inflação" },
  { href: "/comparar", rotulo: "Comparar datas" },
  { href: "/agenda", rotulo: "Agenda" },
];

export function MenuFerramentas() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const ativo = ITENS.some((i) => pathname === i.href);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className={styles.ferramentas}>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls="menu-ferramentas"
        className={ativo ? styles.themeOn : undefined}
        onClick={() => setAberto(!aberto)}
      >
        Ferramentas <span aria-hidden="true">▾</span>
      </button>
      {aberto ? (
        <ul id="menu-ferramentas">
          {ITENS.map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={pathname === i.href ? "page" : undefined} onClick={() => setAberto(false)}>
                {i.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
