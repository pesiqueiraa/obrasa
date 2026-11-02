// Comparador de datas (DESIGN.md, "Ferramentas"): os indicadores do site em dois meses
// escolhidos pela pessoa. Estado no endereço (?a=2025-09&b=2026-09).

import type { Metadata } from "next";
import { Suspense } from "react";
import { Comparador } from "@/components/ferramentas/Comparador";
import styles from "@/components/ferramentas/ferramentas.module.scss";
import tema from "@/components/tema.module.scss";
import { shiftMonths } from "@/lib/format";
import { getComparaveis } from "@/lib/ferramentas";

export const metadata: Metadata = {
  title: "Comparar datas",
  description: "Inflação, juros, desemprego, dívida e educação em duas datas, lado a lado.",
};

function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  for (let m = `${de}-01`; m.slice(0, 7) <= ate; m = shiftMonths(m, 1)) out.push(m.slice(0, 7));
  return out;
}

async function Conteudo({ searchParams }: Pick<PageProps<"/comparar">, "searchParams">) {
  const [sp, series] = await Promise.all([searchParams, getComparaveis()]);
  const primeiros = series.map((s) => s.pontos[0]?.[0].slice(0, 7)).filter(Boolean).sort();
  const ultimos = series.map((s) => s.pontos.at(-1)?.[0].slice(0, 7)).filter(Boolean).sort();
  const meses = mesesEntre(primeiros[0] ?? "1994-07", ultimos.at(-1) ?? "1994-07");
  const valido = (m: unknown): m is string => typeof m === "string" && meses.includes(m);
  // Data B padrão: o mês mais recente com IPCA publicado, para quase tudo ter dado.
  const ipca = series.find((s) => s.slug === "ipca-12-meses")?.pontos.at(-1)?.[0].slice(0, 7) ?? meses.at(-1) ?? "";
  const b = valido(sp.b) ? sp.b : ipca;
  const a = valido(sp.a) ? sp.a : shiftMonths(`${b}-01`, -12).slice(0, 7);
  return <Comparador series={series} meses={meses} inicial={{ a, b }} />;
}

export default function CompararPage(props: PageProps<"/comparar">) {
  return (
    <div className="container section">
      <header className={tema.cabecalho}>
        <h1>Comparar datas</h1>
        <p>Escolha dois meses e veja os indicadores do site em cada um, lado a lado.</p>
      </header>
      <div className={styles.palco}>
        <Suspense fallback={<p>Carregando os indicadores…</p>}>
          <Conteudo searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
