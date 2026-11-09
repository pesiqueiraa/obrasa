// Página de um mandato (docs/10, 3.7.1; D27). Ordem dos blocos: 1. indicadores antes da
// posse e no fim; 2. metas do próprio governo (meta de inflação do CMN); 4. normas do
// período (emendas e leis complementares). O bloco 3 (plano registrado no TSE) entra depois,
// no mesmo formato para todos.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Metas } from "@/components/governos/Metas";
import { Normas } from "@/components/governos/Normas";
import { Plano } from "@/components/governos/Plano";
import { PosseFim } from "@/components/governos/PosseFim";
import styles from "@/components/governos/governos.module.scss";
import tema from "@/components/tema.module.scss";
import ui from "@/components/ui.module.scss";
import { formatDate } from "@/lib/format";
import {
  getMandatos,
  getMetasInflacao,
  getNormasDoMandato,
  getPlanoDoMandato,
  getPosseEFim,
  getSlugsDoConfig,
  type Mandato,
  type Prova,
} from "@/lib/governos";

// Do config, não do banco: banco sem mandato conferido não pode derrubar o build (ver
// getSlugsDoConfig). A página confere no banco e responde 404 ao mandato incompleto.
export async function generateStaticParams() {
  return (await getSlugsDoConfig()).map((mandato) => ({ mandato }));
}

export async function generateMetadata(props: PageProps<"/governos/[mandato]">): Promise<Metadata> {
  const { mandato } = await props.params;
  const m = (await getMandatos()).find((x) => x.slug === mandato);
  return m ? { title: `${m.rotulo}: ${m.presidente}` } : { title: "Governos" };
}

function linkProva(p: Prova): { href: string; rotulo: string } {
  if (p.url) return { href: p.url, rotulo: "Senado Federal, página da matéria" };
  const norma = p.urn!.split("!")[0];
  const rotulo = norma.includes("constituicao") ? "Constituição, art. 82" : "Emenda Constitucional 111/2021, art. 5º";
  return { href: `https://normas.leg.br/?urn=${norma}`, rotulo };
}

function Datas({ m }: { m: Mandato }) {
  const vistos = new Map(m.provas.map((p) => [linkProva(p).href, linkProva(p)]));
  return (
    <p className={ui.sourceLine}>
      Datas conferidas em {formatDate(m.conferidoEm)} no texto de:{" "}
      {[...vistos.values()].map((l, i) => (
        <span key={l.href}>
          {i > 0 ? "; " : null}
          <a href={l.href} rel="noopener">
            {l.rotulo}
          </a>
        </span>
      ))}
      . <Link href="/metodologia#fotos">Créditos da foto</Link>
    </p>
  );
}

async function Blocos({ m }: { m: Mandato }) {
  const [posseFim, metas, plano, normas] = await Promise.all([
    getPosseEFim(m),
    getMetasInflacao(m),
    getPlanoDoMandato(m),
    getNormasDoMandato(m),
  ]);
  return (
    <>
      <section className={styles.secao} aria-labelledby="posse-e-fim">
        <h2 id="posse-e-fim">Antes da posse e no fim do mandato</h2>
        <PosseFim m={m} bloco={posseFim} />
      </section>
      <section className={styles.secao} aria-labelledby="metas">
        <h2 id="metas">Meta de inflação e IPCA</h2>
        <p>
          Todo ano, o governo, pelo Conselho Monetário Nacional, define um alvo para a inflação e uma faixa aceita em
          volta dele. O ponto mostra a inflação que de fato aconteceu no ano (IPCA de dezembro).
        </p>
        <Metas bloco={metas} />
      </section>
      <section className={styles.secao} aria-labelledby="plano">
        <h2 id="plano">O que o plano registrado no TSE promete com número</h2>
        <Plano bloco={plano} />
      </section>
      <section className={styles.secao} aria-labelledby="normas">
        <h2 id="normas">Leis e emendas do período</h2>
        <p>
          Toda emenda à Constituição e lei complementar assinada durante o mandato. Emendas são promulgadas pelo
          Congresso; leis complementares são aprovadas pelo Congresso e sancionadas pela Presidência.
        </p>
        <Normas bloco={normas} />
      </section>
    </>
  );
}

async function Conteudo({ params }: Pick<PageProps<"/governos/[mandato]">, "params">) {
  const { mandato } = await params;
  const mandatos = await getMandatos();
  const i = mandatos.findIndex((x) => x.slug === mandato);
  if (i < 0) notFound();
  const m = mandatos[i];
  const anterior = mandatos[i - 1];
  const seguinte = mandatos[i + 1];
  return (
    <div className="container section">
      <p className={ui.crumb}>
        <Link href="/governos">Governos</Link>
      </p>
      <header className={`${tema.cabecalho} ${styles.cabecalho}`}>
        <figure className={styles.retrato}>
          {/* eslint-disable-next-line @next/next/no-img-element -- carregada do Commons, sem cópia (regra 7) */}
          <img
            src={m.foto.url}
            alt={`Retrato oficial de ${m.presidente}`}
            width={120}
            height={120}
            referrerPolicy="no-referrer"
          />
        </figure>
        <div>
          <h1>{m.rotulo}</h1>
          <p>
            {m.presidente}, de {formatDate(m.inicio)} a {m.fim ? formatDate(m.fim) : "hoje (mandato em curso)"}.
            {m.nota ? ` ${m.nota}` : null}
          </p>
          <Datas m={m} />
        </div>
      </header>
      <Suspense fallback={<p className={ui.caption}>Carregando indicadores…</p>}>
        <Blocos m={m} />
      </Suspense>
      <nav className={styles.vizinhos} aria-label="Outros mandatos">
        {anterior ? <Link href={`/governos/${anterior.slug}`}>← {anterior.rotulo}</Link> : <span />}
        {seguinte ? <Link href={`/governos/${seguinte.slug}`}>{seguinte.rotulo} →</Link> : <span />}
      </nav>
    </div>
  );
}

export default function MandatoPage(props: PageProps<"/governos/[mandato]">) {
  return (
    <Suspense fallback={<div className="container section">Carregando mandato…</div>}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}
