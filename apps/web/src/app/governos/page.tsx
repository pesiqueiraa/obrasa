// Aba Governos (docs/10, 3.7.1; D27): trilha dos mandatos com todos os indicadores (desde
// 2003). Cada parada: retrato oficial, nome e anos; o resto fica na página do mandato. Mesmo
// formato e mesma cor para todos; sem ordem por desempenho, nota ou cor de partido
// (docs/02). Autor e licença das fotos ficam em /metodologia#fotos, como as licenças pedem.

import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { TodosMandatos } from "@/components/governos/TodosMandatos";
import { Trilha, type Parada } from "@/components/governos/Trilha";
import governos from "@/components/governos/governos.module.scss";
import tema from "@/components/tema.module.scss";
import ui from "@/components/ui.module.scss";
import { getMandatos, getTodosMandatos } from "@/lib/governos";

export const metadata: Metadata = {
  title: "Governos",
  description:
    "Cada mandato presidencial desde 2003 no mesmo formato: os indicadores antes da posse e no fim do mandato, a meta de inflação ao lado do IPCA de cada ano e cada indicador ao longo de todos os mandatos.",
};

async function Conteudo() {
  "use cache";
  cacheLife("hours");
  cacheTag("governos", "indicadores");
  const mandatos = await getMandatos();
  if (mandatos.length === 0) {
    return (
      <p className={ui.caption}>
        Os mandatos estão em conferência: cada um só aparece aqui depois de conferido no texto da Constituição e nos
        registros do Senado.
      </p>
    );
  }
  const paradas: Parada[] = mandatos.map((m) => ({
    slug: m.slug,
    rotulo: m.rotulo,
    presidente: m.presidente,
    anos: `${m.inicio.slice(0, 4)}–${m.fim ? m.fim.slice(0, 4) : "hoje"}`,
    foto: m.foto.url,
    emCurso: m.fim === null,
  }));
  return <Trilha paradas={paradas} />;
}

async function Comparacao() {
  "use cache";
  cacheLife("hours");
  cacheTag("governos", "indicadores");
  const bloco = await getTodosMandatos();
  if (bloco.series.length === 0) return null;
  return (
    <section className={governos.secao} aria-labelledby="todos">
      <h2 id="todos">Um indicador em todos os mandatos</h2>
      <p>Escolha um indicador e veja o caminho dele de 2003 até hoje. Cada faixa é um mandato; toque na foto para abrir.</p>
      <TodosMandatos bloco={bloco} />
    </section>
  );
}

export default function GovernosPage() {
  return (
    <div className="container section">
      <header className={tema.cabecalho}>
        <h1>Governos</h1>
        <p>Cada mandato desde 2003, do primeiro ao atual. Toque num presidente para ver como o país estava na posse e no fim.</p>
      </header>
      <Suspense fallback={<p className={ui.caption}>Carregando mandatos…</p>}>
        <Conteudo />
      </Suspense>
      <Suspense fallback={null}>
        <Comparacao />
      </Suspense>
      <p className={ui.sourceLine}>
        Começa em 2003: é o primeiro mandato com todos os indicadores antes da posse.{" "}
        <Link href="/metodologia#governos">Metodologia</Link> ·{" "}
        <Link href="/metodologia#fotos">Créditos das fotos</Link>
      </p>
    </div>
  );
}
