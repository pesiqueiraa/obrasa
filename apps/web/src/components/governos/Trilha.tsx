"use client";

// /governos como trilha (DESIGN.md, "Página Governos", `mandate-trail`): um caminho que
// desce pela página e para em cada mandato, com o retrato oficial, o nome e os anos. O
// caminho se desenha conforme a pessoa rola (ligado à rolagem, sem loop) e cada parada
// aparece ao entrar na tela; com "reduzir movimento", tudo já aparece desenhado. No desktop
// as paradas alternam esquerda e direita; no celular, o caminho segue pela esquerda. Mesmo
// tamanho, mesma moldura e mesma cor para todos (docs/02, seção 8). O mandato em curso
// termina num trecho tracejado.

import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./governos.module.scss";

export type Parada = { slug: string; rotulo: string; presidente: string; anos: string; foto: string; emCurso: boolean };

const ALTURA = { desktop: 220, celular: 168 };
const FOTO = { desktop: 112, celular: 80 };

function xDe(i: number, largura: number, desktop: boolean): number {
  if (!desktop) return FOTO.celular / 2 + 4;
  return largura * (i % 2 === 0 ? 0.28 : 0.6);
}

export function Trilha({ paradas }: { paradas: Parada[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const [largura, setLargura] = useState(0);
  const [desktop, setDesktop] = useState(true);
  const reduzir = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const progresso = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 672px)");
    const mede = () => {
      setLargura(el.clientWidth);
      setDesktop(mq.matches);
    };
    mede();
    const ro = new ResizeObserver(mede);
    ro.observe(el);
    mq.addEventListener("change", mede);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", mede);
    };
  }, []);

  const h = desktop ? ALTURA.desktop : ALTURA.celular;
  const pontos = paradas.map((_, i) => ({ x: xDe(i, largura, desktop), y: i * h + h / 2 }));
  let d = "";
  pontos.forEach((p, i) => {
    if (i === 0) {
      d = `M${p.x},${p.y - h / 2}L${p.x},${p.y}`;
      return;
    }
    const a = pontos[i - 1];
    const meio = (a.y + p.y) / 2;
    d += `C${a.x},${meio} ${p.x},${meio} ${p.x},${p.y}`;
  });
  const ultimo = pontos.at(-1);
  const emCurso = paradas.at(-1)?.emCurso;
  const total = paradas.length * h;

  return (
    <ol
      ref={ref}
      className={styles.trilha}
      style={{ height: total + (emCurso ? h / 2 : 0) }}
      aria-label="Mandatos presidenciais, do mais antigo ao atual"
    >
      {largura > 0 ? (
        <svg className={styles.trilhaSvg} width={largura} height={total + h / 2} aria-hidden="true" focusable="false">
          <path d={d} fill="none" stroke="var(--bd-color-hairline)" strokeWidth={6} strokeLinecap="round" />
          <motion.path
            d={d}
            fill="none"
            stroke="var(--bd-color-chart-1)"
            strokeWidth={6}
            strokeLinecap="round"
            style={{ pathLength: reduzir ? 1 : progresso }}
          />
          {emCurso && ultimo ? (
            <line
              x1={ultimo.x}
              x2={ultimo.x}
              y1={ultimo.y}
              y2={ultimo.y + h / 2}
              stroke="var(--bd-color-chart-1)"
              strokeWidth={6}
              strokeDasharray="2 12"
              strokeLinecap="round"
            />
          ) : null}
        </svg>
      ) : null}
      {paradas.map((p, i) => {
        const pt = pontos[i];
        const foto = desktop ? FOTO.desktop : FOTO.celular;
        return (
          <li key={p.slug} style={{ top: i * h, height: h }}>
            <motion.div
              className={styles.parada}
              style={{ left: Math.max(0, pt.x - foto / 2), top: h / 2 - foto / 2 }}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.45, ease: [0.2, 0, 0.38, 0.9] }}
            >
              <Link href={`/governos/${p.slug}`} className={styles.paradaLink}>
                {/* eslint-disable-next-line @next/next/no-img-element -- carregada do Commons, sem cópia (regra 7) */}
                <img
                  src={p.foto}
                  alt=""
                  width={foto}
                  height={foto}
                  loading={i < 3 ? "eager" : "lazy"}
                  referrerPolicy="no-referrer"
                  className={styles.paradaFoto}
                />
                <span className={styles.paradaTexto}>
                  <strong>{p.rotulo}</strong>
                  <span className={styles.paradaAnos}>{p.anos}</span>
                  <span className="visually-hidden">{p.presidente}</span>
                </span>
              </Link>
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
}
