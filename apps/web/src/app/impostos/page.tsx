// Impostos (docs/10, 2.7; regras em docs/02, seção 9). Ordem: o que muda e quando
// (linha do tempo da lei) → quanto o governo arrecada → o que está em discussão (projetos,
// separados e com selo de proposta) → notícias do tema.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrecadacaoBloco } from "@/components/impostos/ArrecadacaoBloco";
import styles from "@/components/impostos/impostos.module.scss";
import { LinhaDoTempo } from "@/components/impostos/LinhaDoTempo";
import { Projetos } from "@/components/impostos/Projetos";
import { NoticiasTema } from "@/components/noticias/NoticiasTema";
import tema from "@/components/tema.module.scss";
import ui from "@/components/ui.module.scss";
import { getArrecadacao, getMarcos, getProposicoes } from "@/lib/impostos";

export const metadata: Metadata = {
  title: "Impostos",
  description:
    "O que muda nos impostos de 2026 a 2033, para pessoas e empresas, com a lei de cada regra; quanto o governo federal arrecada; e os projetos em discussão na Câmara.",
};

// Só para revisão local dos marcos ainda sem conferência humana (docs/02, seção 9).
const RASCUNHOS = process.env.OBRASA_MARCOS_RASCUNHO === "1";

async function Marcos() {
  const { marcos, hoje } = await getMarcos(RASCUNHOS);
  if (marcos.length === 0) {
    return (
      <p className={ui.caption}>
        Os marcos da reforma estão em revisão: cada um só aparece aqui depois que uma pessoa confere o artigo da lei
        citado.
      </p>
    );
  }
  return (
    <>
      <LinhaDoTempo marcos={marcos} hoje={hoje} />
      <p className={ui.sourceLine}>
        Fonte: texto das leis no Planalto (Emenda Constitucional 132/2023, Lei Complementar 214/2025 e Lei 15.270/2025),
        com o artigo citado em cada marco.
      </p>
    </>
  );
}

async function Arrecadacao() {
  const a = await getArrecadacao();
  if (!a) return <p>A arrecadação ainda não foi coletada da Receita Federal.</p>;
  return <ArrecadacaoBloco a={a} />;
}

async function EmDiscussao() {
  return <Projetos projetos={await getProposicoes()} />;
}

export default function ImpostosPage() {
  return (
    <>
      <div className="container section">
        <header className={tema.cabecalho}>
          <h1>Impostos</h1>
          <p>
            O que muda nos impostos e quando, para pessoas e empresas, com a lei de cada regra. Quanto o governo federal
            arrecada por mês. E os projetos em discussão na Câmara, separados do que já é lei.
          </p>
        </header>
      </div>

      <div className="container section">
        <section className={styles.secao} aria-labelledby="o-que-muda">
          <h2 id="o-que-muda">O que muda e quando</h2>
          <p>
            A reforma tributária troca PIS, Cofins, IPI, ICMS e ISS por CBS, IBS e Imposto Seletivo, aos poucos, de 2026
            a 2033. O imposto de renda das pessoas físicas também mudou em 2026.
          </p>
          <Suspense fallback={<p>Carregando a linha do tempo…</p>}>
            <Marcos />
          </Suspense>
        </section>
      </div>

      <div className="section section--surface">
        <div className="container">
          <Suspense fallback={<p>Carregando a arrecadação…</p>}>
            <Arrecadacao />
          </Suspense>
        </div>
      </div>

      <div className="container section">
        <section className={styles.secao} aria-labelledby="em-discussao">
          <h2 id="em-discussao">Em discussão na Câmara</h2>
          <p>
            Propostas de emenda à Constituição (PEC), de lei complementar (PLP) e de lei (PL) com tramitação nos últimos
            30 dias e com imposto, tributo, IBS, CBS ou Imposto Seletivo na ementa. Nenhuma delas é lei.
          </p>
          <Suspense fallback={<p>Carregando os projetos…</p>}>
            <EmDiscussao />
          </Suspense>
        </section>
      </div>

      <div className="container section">
        <Suspense fallback={null}>
          <NoticiasTema tema="impostos" titulo="Impostos" />
        </Suspense>
        <p className={ui.caption}>
          Como cada dado é coletado e conferido: <Link href="/metodologia">metodologia</Link>.
        </p>
      </div>
    </>
  );
}
