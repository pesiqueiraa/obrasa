"use client";

// Notícias em páginas (DESIGN.md, módulo de notícias): um tema por página, como folhear
// um jornal. Passa de página arrastando para o lado (celular), pelas setas, pelas teclas
// ← → ou pelo nome do tema. A rolagem para baixo dentro da página continua normal; nada
// prende o scroll. Cada página tem endereço próprio (#economia), que o botão voltar do
// navegador respeita.

import { AnimatePresence, motion, type PanInfo, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import styles from "./noticias.module.scss";

export type Pagina = { slug: string; titulo: string; conta: number | null; conteudo: ReactNode };

function assina(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const hashAtual = () => decodeURIComponent(window.location.hash.slice(1));
const hashServidor = () => "";

export function Paginas({ paginas }: { paginas: Pagina[] }) {
  const hash = useSyncExternalStore(assina, hashAtual, hashServidor);
  const i = Math.max(
    0,
    paginas.findIndex((p) => p.slug === hash),
  );
  const [dir, setDir] = useState(0);
  const reduz = useReducedMotion();
  const topo = useRef<HTMLDivElement>(null);
  const atual = paginas[i];
  const anterior = paginas[i - 1];
  const proxima = paginas[i + 1];

  function vai(j: number) {
    if (j < 0 || j >= paginas.length || j === i) return;
    setDir(j > i ? 1 : -1);
    window.location.hash = paginas[j].slug;
    const y = topo.current?.getBoundingClientRect().top ?? 0;
    if (y < 0) topo.current?.scrollIntoView({ behavior: reduz ? "auto" : "smooth" });
  }

  // A aba da página atual fica visível na faixa de abas, que rola de lado no celular.
  const abas = useRef<HTMLElement>(null);
  useEffect(() => {
    const aba = abas.current?.querySelector<HTMLElement>("[aria-current=page]");
    if (!aba || !abas.current) return;
    const faixa = abas.current;
    faixa.scrollTo({ left: aba.offsetLeft - (faixa.clientWidth - aba.offsetWidth) / 2, behavior: "smooth" });
  }, [i]);

  const passo = useEffectEvent((d: number) => vai(i + d));
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || alvo?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") passo(1);
      if (e.key === "ArrowLeft") passo(-1);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // Depois de arrastar, o clique que o navegador gera ao soltar não abre a matéria.
  const arrastou = useRef(false);

  function solta(_: unknown, info: PanInfo) {
    arrastou.current = Math.abs(info.offset.x) > 8;
    const forte = Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 500;
    if (!forte || Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
    vai(info.offset.x < 0 ? i + 1 : i - 1);
  }

  const desloca = reduz ? 0 : 48;
  return (
    <div ref={topo} className={styles.paginas}>
      <nav ref={abas} aria-label="Páginas de notícias" className={styles.abas}>
        {paginas.map((p, j) => (
          <a
            key={p.slug}
            href={`#${p.slug}`}
            aria-current={j === i ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              vai(j);
            }}
          >
            {p.titulo}
            {p.conta != null ? <span>{p.conta}</span> : null}
          </a>
        ))}
      </nav>

      <div className={styles.barra}>
        <button type="button" onClick={() => vai(i - 1)} disabled={!anterior} aria-label="Página anterior">
          ‹<span>{anterior?.titulo}</span>
        </button>
        <p aria-live="polite">
          {i + 1} de {paginas.length}
        </p>
        <button type="button" onClick={() => vai(i + 1)} disabled={!proxima} aria-label="Próxima página">
          <span>{proxima?.titulo}</span>›
        </button>
      </div>

      <div className={styles.palco}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.section
            key={atual.slug}
            aria-label={atual.titulo}
            custom={dir}
            variants={{
              entra: (d: number) => ({ x: d * desloca, opacity: 0 }),
              fica: { x: 0, opacity: 1 },
              sai: (d: number) => ({ x: -d * desloca, opacity: 0 }),
            }}
            initial="entra"
            animate="fica"
            exit="sai"
            transition={{ duration: reduz ? 0 : 0.22, ease: [0.2, 0, 0.38, 0.9] }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            dragSnapToOrigin
            onDragStart={() => {
              arrastou.current = true;
            }}
            onDragEnd={solta}
            onClickCapture={(e) => {
              if (arrastou.current) {
                e.preventDefault();
                e.stopPropagation();
                arrastou.current = false;
              }
            }}
            className={styles.pagina}
          >
            {atual.conteudo}
          </motion.section>
        </AnimatePresence>
      </div>

      {proxima ? (
        <button type="button" className={styles.virar} onClick={() => vai(i + 1)}>
          <span>Próxima página</span>
          {proxima.titulo} ›
        </button>
      ) : null}
    </div>
  );
}
