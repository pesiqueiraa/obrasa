"use client";

// Cabeçalho fixo que sai de cena ao rolar para baixo e volta ao rolar para cima. No
// celular ele tem duas linhas (marca e temas) e tomaria ~11% da tela o tempo todo. O
// recolhimento só vale abaixo de 1056px (ui.module.scss); no desktop o atributo não
// tem efeito. Não recolhe com o menu Ferramentas aberto nem com o foco de teclado dentro
// dele (:focus-visible; o foco que fica no link tocado não conta).

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ui.module.scss";

const FOLGA = 8; // px de rolagem antes de mudar de estado, para não piscar

export function CabecalhoRecolhe({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    let ultimo = window.scrollY;
    const aoRolar = () => {
      const y = window.scrollY;
      const el = ref.current;
      const delta = y - ultimo;
      if (Math.abs(delta) < FOLGA) return;
      ultimo = y;
      const preso = !!el && !!el.querySelector(":focus-visible, [aria-expanded=true]");
      if (delta > 0 && y > (el?.offsetHeight ?? 0) && !preso) setOculto(true);
      else if (delta < 0) setOculto(false);
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      ref={ref}
      className={styles.topNav}
      data-oculto={oculto || undefined}
      onFocusCapture={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) setOculto(false);
      }}
    >
      {children}
    </header>
  );
}
