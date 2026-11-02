"use client";

// Leitura por mouse ou dedo, comum a gráficos e mapas (DESIGN.md, "Responsive Behavior").
// - Mouse: a leitura segue o ponteiro e some ao sair.
// - Dedo: tocar mostra o ponto; arrastar para os lados percorre os pontos. A leitura fica
//   depois de soltar e some ao tocar fora. O elemento usa `touch-action: pan-y`: arrastar
//   para cima ou para baixo continua rolando a página.
// `ler` recebe a posição do ponteiro na tela e devolve o que está ali (ou null). No toque,
// o navegador prende o ponteiro ao elemento onde o dedo pousou, então quem lê deve usar a
// posição (clientX/clientY, elementFromPoint), não o alvo do evento.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type Ponteiro = { clientX: number; clientY: number; alvo: Element; toque: boolean };

export function useLeitura<T, E extends Element = HTMLElement>(ler: (p: Ponteiro) => T | null) {
  const [foco, setFoco] = useState<T | null>(null);
  const ref = useRef<E>(null);
  const toque = useRef(false);

  useEffect(() => {
    if (foco === null || !toque.current) return;
    const fora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setFoco(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [foco]);

  const le = (e: ReactPointerEvent<E>) =>
    setFoco(ler({ clientX: e.clientX, clientY: e.clientY, alvo: e.currentTarget, toque: e.pointerType !== "mouse" }));

  const props = {
    ref,
    style: { touchAction: "pan-y" } as const,
    onPointerDown: (e: ReactPointerEvent<E>) => {
      toque.current = e.pointerType !== "mouse";
      le(e);
    },
    onPointerMove: (e: ReactPointerEvent<E>) => {
      // no toque só chega movimento com o dedo na tela
      if (e.pointerType === "mouse") toque.current = false;
      le(e);
    },
    onPointerLeave: (e: ReactPointerEvent<E>) => {
      if (e.pointerType === "mouse") setFoco(null);
    },
  };

  return { foco, setFoco, props };
}
