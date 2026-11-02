// Calculadora da inflação (DESIGN.md, "Ferramentas"). O estado da conta vem do endereço
// (?v=2000_2015-01,2000_2020-01&base=2026-09), para a pessoa compartilhar a comparação.

import type { Metadata } from "next";
import { Suspense } from "react";
import { Calculadora, type Linha } from "@/components/ferramentas/Calculadora";
import styles from "@/components/ferramentas/ferramentas.module.scss";
import tema from "@/components/tema.module.scss";
import { formatNumber } from "@/lib/format";
import { getIndiceIpca } from "@/lib/ferramentas";

export const metadata: Metadata = {
  title: "Calculadora da inflação",
  description: "Quanto um valor em reais de um mês equivale em outro mês, pelo IPCA do IBGE.",
};

async function Conteudo({ searchParams }: Pick<PageProps<"/calculadora">, "searchParams">) {
  const sp = await searchParams;
  const indice = await getIndiceIpca();
  const meses = new Set(indice.pontos.map(([m]) => m));
  const ultimo = indice.pontos.at(-1)?.[0] ?? "";
  const base = typeof sp.base === "string" && meses.has(sp.base) ? sp.base : ultimo;
  const pedidas = (typeof sp.v === "string" ? sp.v.split(",") : [])
    .map((par) => par.split("_"))
    .filter(([v, m]) => Number.isFinite(Number(v)) && meses.has(m))
    .slice(0, 6);
  const linhas: Linha[] = (
    pedidas.length
      ? pedidas
      : [
          ["2000", "2015-01"],
          ["2000", "2020-01"],
        ]
  ).map(([v, m], i) => ({ id: i + 1, valor: formatNumber(Number(v), Number(v) % 1 ? 2 : 0), mes: m }));
  return <Calculadora indice={indice} inicial={{ linhas, base }} />;
}

export default function CalculadoraPage(props: PageProps<"/calculadora">) {
  return (
    <div className="container section">
      <header className={tema.cabecalho}>
        <h1>Calculadora da inflação</h1>
        <p>Quanto um valor em reais de um mês equivale em outro mês. Compare quantos valores e datas quiser.</p>
      </header>
      <div className={styles.palco}>
        <Suspense fallback={<p>Carregando o IPCA…</p>}>
          <Conteudo searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
