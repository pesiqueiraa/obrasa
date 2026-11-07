// Arrecadação federal mês a mês (Receita Federal), real e nominal (regra 3). O valor real
// é o nominal corrigido pelo número-índice do IPCA a preços do mês-base, conta feita sobre
// valores do banco (lib/real.ts). Abaixo, quanto cada tributo somou nos últimos 12 meses,
// em barras na mesma escala, maior para o menor.

import { ChartPanel, type Variante } from "@/components/ChartPanel";
import { SourceLine } from "@/components/SourceLine";
import ui from "@/components/ui.module.scss";
import { formatNumber, formatRef, formatRefLong } from "@/lib/format";
import type { Arrecadacao } from "@/lib/impostos";
import styles from "./impostos.module.scss";

const bi = (milhoes: number) => milhoes / 1000;

export function ArrecadacaoBloco({ a }: { a: Arrecadacao }) {
  const { total, totalReal, base } = a;
  const ultimo = total.obs.at(-1)!;
  const primeiro = total.obs[0];
  const periodo = `${formatRef(primeiro.refDate)} a ${formatRef(ultimo.refDate)}`;
  const fonteReceita = (
    <SourceLine
      source={total.source}
      series={total.series}
      refDate={ultimo.refDate}
      periodo={periodo}
      atualizadoEm={null}
    />
  );
  const variantes: Variante[] = [
    {
      id: "real",
      rotulo: "Real",
      serieRotulo: "Arrecadação federal, valor real",
      subtitulo: `Soma mensal do arquivo por estado da Receita, em R$ bilhões a preços de ${formatRefLong(base)}, corrigida pelo IPCA. Série desde ${formatRef(primeiro.refDate)}.`,
      obs: totalReal.map((p) => ({ refDate: p.refDate, value: bi(p.value) })),
      sourceLine: (
        <>
          {fonteReceita}
          <p className={ui.sourceLine}>
            Correção:{" "}
            {a.ipca.url ? (
              <a href={a.ipca.url} rel="noopener">
                {a.ipca.orgao}
              </a>
            ) : (
              a.ipca.orgao
            )}
            , IPCA ({formatRef(a.ipca.ref)})
          </p>
        </>
      ),
    },
    {
      id: "nominal",
      rotulo: "Nominal",
      serieRotulo: "Arrecadação federal, valor nominal",
      subtitulo: `Soma mensal do arquivo por estado da Receita, em R$ bilhões de cada mês, sem correção pela inflação. Série desde ${formatRef(primeiro.refDate)}.`,
      obs: total.obs.map((o) => ({ refDate: o.refDate, value: bi(o.value) })),
      sourceLine: fonteReceita,
    },
  ];
  const doze = [...a.doze].sort((x, y) => y.valor - x.valor);
  const soma = doze.reduce((s, g) => s + g.valor, 0);
  const maior = Math.max(...doze.map((g) => g.valor));
  return (
    <>
      <ChartPanel
        titulo="Arrecadação federal por mês"
        unidade="R$ bilhões"
        casas={1}
        frequencia="mensal"
        eixo="R$ bilhões"
        variantes={variantes}
        janelaPadrao="10a"
        csvHref="/impostos/arrecadacao.csv"
      />
      <h3 className={styles.subtitulo}>
        Por tributo, de {formatRefLong(a.dozeDe)} a {formatRefLong(a.dozeAte)}
      </h3>
      <p className={ui.caption}>
        Soma dos 12 meses, em R$ bilhões a preços de {formatRefLong(base)}. Total: R$ {formatNumber(bi(soma), 1)}{" "}
        bilhões.
      </p>
      <table className={styles.barras}>
        <caption className="visually-hidden">Arrecadação por tributo nos últimos 12 meses</caption>
        <thead className="visually-hidden">
          <tr>
            <th scope="col">Tributo</th>
            <td />
            <th scope="col">R$ bilhões</th>
            <th scope="col">Parte do total</th>
          </tr>
        </thead>
        <tbody>
          {doze.map((g) => (
            <tr key={g.id}>
              <th scope="row">{g.nome}</th>
              <td className={styles.trilho} aria-hidden="true">
                <span className={styles.barra} style={{ width: `${(100 * Math.max(g.valor, 0)) / maior}%` }} />
              </td>
              <td className={styles.barraValor}>R$ {formatNumber(bi(g.valor), 1)} bi</td>
              <td className={styles.barraParte}>{formatNumber((100 * g.valor) / soma, 1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fonteReceita}
      <p className={ui.caption}>
        O total é a soma do arquivo de arrecadação por estado e pode diferir do total do relatório mensal da Receita,
        que inclui receitas não distribuídas por estado. Cada coluna do arquivo entra num grupo pela lista pública do
        arquivo config/impostos.yaml, no código do oBrasa.
      </p>
    </>
  );
}
