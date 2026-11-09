"use client";

// Bloco 3 da aba Governos (DESIGN.md, `mandate-plan`; docs/02, seção 10): os trechos do plano
// registrado no TSE pela candidatura eleita que trazem um número, citados como estão no PDF,
// com a página. Um modelo de IA localizou os trechos; o código conferiu cada um, palavra por
// palavra, na página citada. Sem veredito: nada diz se a promessa foi cumprida. Quando o
// trecho é da área de um indicador da aba, o card leva até ele. Mostra 6 e abre o resto.

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import ui from "@/components/ui.module.scss";
import { formatDate } from "@/lib/format";
import type { BlocoPlano } from "@/lib/governos";
import styles from "./governos.module.scss";

const INICIAL = 6;

export function Plano({ bloco }: { bloco: BlocoPlano }) {
  const [todos, setTodos] = useState(false);
  if (bloco.tipo === "sem_plano") {
    return (
      <p>
        {bloco.frase}
        {bloco.ver ? (
          <>
            {" "}
            <Link href={`/governos/${bloco.ver.slug}#plano`}>Ver o plano na página de {bloco.ver.rotulo}</Link>.
          </>
        ) : null}
      </p>
    );
  }
  if (bloco.tipo === "pendente") {
    return <p className={ui.caption}>O plano deste mandato está em conferência e aparece aqui depois de conferido.</p>;
  }
  const { trechos } = bloco;
  const visiveis = todos ? trechos : trechos.slice(0, INICIAL);
  if (trechos.length === 0) {
    return (
      <>
        <p>
          O plano registrado no TSE ({bloco.paginas} páginas) não traz promessa com número ou prazo. O texto completo
          está no link da fonte.
        </p>
        <Fonte bloco={bloco} />
      </>
    );
  }
  return (
    <>
      <p>
        Todo trecho do plano de governo da chapa eleita que traz uma meta, quantidade, valor ou prazo, copiado como está
        no PDF. O oBrasa não diz se a promessa foi cumprida.
      </p>
      <p className={styles.planoContagem}>
        <span className={styles.filtroN}>{trechos.length}</span>
        <span>
          {trechos.length === 1 ? "trecho com número" : "trechos com número"} em {bloco.paginas} páginas
        </span>
      </p>
      <ol className={styles.planoLista}>
        {visiveis.map((t, i) => (
          <motion.li
            key={`${t.pagina}-${i}`}
            className={styles.planoCard}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.3, delay: Math.min(i, 5) * 0.06 }}
          >
            <blockquote className={styles.planoTrecho}>“{t.trecho}”</blockquote>
            <p className={styles.planoRodape}>
              <span>Página {t.pagina}</span>
              {t.indicador ? (
                <a className={styles.selo} href={`#ind-${t.indicador.id}`}>
                  {t.indicador.titulo}
                </a>
              ) : null}
            </p>
          </motion.li>
        ))}
      </ol>
      {trechos.length > INICIAL ? (
        <button type="button" className={styles.verMais} onClick={() => setTodos((v) => !v)} aria-expanded={todos}>
          {todos ? "Mostrar menos" : `Ver todos (${trechos.length})`}
        </button>
      ) : null}
      <Fonte bloco={bloco} />
    </>
  );
}

function Fonte({ bloco }: { bloco: Extract<BlocoPlano, { tipo: "plano" }> }) {
  return (
    <p className={`${ui.sourceLine} ${styles.planoFonte}`}>
      Fonte:{" "}
      <a href={bloco.urlPacote} rel="noopener">
        {bloco.fonte.orgao}, planos de governo de {bloco.ano}
      </a>{" "}
      (arquivo {bloco.arquivo.split("/").pop()}, conferido em {formatDate(bloco.conferidoEm)}). Trechos localizados por
      IA e conferidos, palavra por palavra, na página citada. <Link href="/metodologia#planos">Como funciona</Link>
    </p>
  );
}
