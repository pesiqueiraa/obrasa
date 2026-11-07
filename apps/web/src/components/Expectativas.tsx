// "O que o mercado espera" (docs/10, 2.1): medianas do Focus para o ano corrente e o
// seguinte, na página do indicador. É a terceira pergunta de toda tela ("o que vem por
// aí?") respondida sem previsão do oBrasa: a expectativa é das instituições consultadas
// pelo Banco Central, e a tela diz isso.

import { formatDate, formatValue } from "@/lib/format";
import { getExpectativas } from "@/lib/impostos";
import styles from "./ui.module.scss";

const FOCUS_URL =
  "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/aplicacao#!/recursos/ExpectativasMercadoAnuais";

/** O que a mediana mede, por indicador do Focus. */
const O_QUE: Record<string, (ano: number) => string> = {
  IPCA: (a) => `IPCA acumulado em ${a}`,
  Selic: (a) => `Selic no fim de ${a}`,
  Câmbio: (a) => `Dólar no fim de ${a}`,
  "PIB Total": (a) => `Variação do PIB em ${a}`,
  "Taxa de desocupação": (a) => `Taxa de desocupação em ${a}`,
  "Resultado primário": (a) => `Resultado primário em ${a}`,
  "Dívida bruta do governo geral": (a) => `Dívida bruta no fim de ${a}`,
  "Dívida líquida do setor público": (a) => `Dívida líquida no fim de ${a}`,
};

const UNIDADE: Record<string, string> = {
  Selic: "% a.a.",
  Câmbio: "R$/US$",
  "Resultado primário": "% do PIB",
  "Dívida bruta do governo geral": "% do PIB",
  "Dívida líquida do setor público": "% do PIB",
};

export async function Expectativas({ focus, casas }: { focus: string; casas: number }) {
  const e = await getExpectativas(focus);
  if (!e) return null;
  const unidade = UNIDADE[focus] ?? "%";
  const rotulo = O_QUE[focus] ?? ((a: number) => `${focus} em ${a}`);
  return (
    <section className={styles.expectativas} aria-labelledby="expectativas-titulo">
      <h2 id="expectativas-titulo" className={styles.expectativasTitulo}>
        O que o mercado espera
      </h2>
      <dl className={styles.expectativasLista}>
        {e.anos.map((a) => (
          <div key={a.ano}>
            <dt>{rotulo(a.ano)}</dt>
            <dd>
              {formatValue(a.mediana, unidade, focus === "Câmbio" ? 2 : Math.min(casas, 2))}
              {a.respondentes ? <span className={styles.caption}> mediana de {a.respondentes} respostas</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.caption}>
        Expectativa de bancos e outras instituições financeiras consultadas pelo Banco Central. Não é previsão oficial
        nem do oBrasa.
      </p>
      <p className={styles.sourceLine}>
        Fonte:{" "}
        <a href={FOCUS_URL} rel="noopener">
          Banco Central, Focus
        </a>{" "}
        ({formatDate(e.dataPesquisa)})
      </p>
    </section>
  );
}
