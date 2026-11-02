"use client";

// Comparador de datas (DESIGN.md, "Ferramentas"): os indicadores do site em dois meses
// que a pessoa escolhe, lado a lado. Em cada data vale o último dado publicado até o fim
// daquele mês, e o período de referência aparece embaixo do número. Sem atalhos por
// governo ou mandato: só distâncias de tempo ("1 ano antes").

import Link from "next/link";
import { Fragment, useState } from "react";
import { formatRef, formatValue, shiftMonths, type FrequenciaRef } from "@/lib/format";
import { diferenca, noMes, type Ponto } from "@/lib/contas";
import type { SerieComparavel } from "@/lib/ferramentas";
import { Variacao } from "../Variacao";
import { SeletorMes } from "./SeletorMes";
import ui from "../ui.module.scss";
import styles from "./ferramentas.module.scss";

const ATALHOS = [
  { rotulo: "1 ano antes", meses: 12 },
  { rotulo: "5 anos antes", meses: 60 },
  { rotulo: "10 anos antes", meses: 120 },
];

export function Comparador(props: { series: SerieComparavel[]; meses: string[]; inicial: { a: string; b: string } }) {
  const { series, meses } = props;
  const [a, setA] = useState(props.inicial.a);
  const [b, setB] = useState(props.inicial.b);

  function grava(na: string, nb: string) {
    setA(na);
    setB(nb);
    window.history.replaceState(null, "", `?a=${na}&b=${nb}`);
  }
  const primeiro = meses[0];
  const atalho = (n: number) => {
    const alvo = shiftMonths(`${b}-01`, -n).slice(0, 7);
    grava(alvo < primeiro ? primeiro : alvo, b);
  };

  const temas = [...new Set(series.map((s) => s.tema))];
  const fmtMes = (m: string) => formatRef(`${m}-01`);

  return (
    <div className={styles.comp}>
      <div className={styles.datas}>
        <div className={styles.data}>
          <span className={styles.dataRotulo}>Data A</span>
          <SeletorMes meses={meses} valor={a} onChange={(m) => grava(m, b)} rotulo="Data A" />
          <div className={styles.atalhos}>
            {ATALHOS.map((x) => (
              <button key={x.meses} type="button" onClick={() => atalho(x.meses)}>
                {x.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.data}>
          <span className={styles.dataRotulo}>Data B</span>
          <SeletorMes meses={meses} valor={b} onChange={(m) => grava(a, m)} rotulo="Data B" />
        </div>
      </div>

      <table className={styles.tabela}>
        <caption className="visually-hidden">
          Indicadores em {fmtMes(a)} e em {fmtMes(b)}
        </caption>
        <thead>
          <tr>
            <th scope="col">Indicador</th>
            <th scope="col">{fmtMes(a)}</th>
            <th scope="col">{fmtMes(b)}</th>
            <th scope="col">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {temas.map((tema) => {
            const doTema = series.filter((s) => s.tema === tema);
            return (
              <Fragment key={tema}>
                <tr className={styles.tema}>
                  <th scope="rowgroup" colSpan={4}>
                    {doTema[0].temaTitulo}
                  </th>
                </tr>
                {doTema.map((s) => {
                  const pa = noMes(s.pontos, a);
                  const pb = noMes(s.pontos, b);
                  const freq = s.frequencia as FrequenciaRef;
                  const fmt = (n: number) => formatValue(n, s.unidade, s.casas);
                  const d = pa && pb ? diferenca(s, pa[1], pb[1]) : null;
                  const nominal = (p: Ponto | null) => (p && s.nominal ? noMes(s.nominal, p[0].slice(0, 7)) : null);
                  const celula = (p: Ponto | null, rotulo: string) => (
                    <td data-rotulo={rotulo}>
                      {p ? (
                        <>
                          <span className={styles.valor}>{fmt(p[1])}</span>
                          <span className={styles.ref}>
                            {formatRef(p[0], freq)}
                            {nominal(p) ? `, nominal ${fmt(nominal(p)?.[1] ?? 0)}` : null}
                          </span>
                        </>
                      ) : (
                        <span className={styles.ref}>sem dado publicado</span>
                      )}
                    </td>
                  );
                  return (
                    <tr key={s.slug}>
                      <th scope="row">
                        <Link href={`/indicador/${s.slug}`}>{s.titulo}</Link>
                        <p className={ui.sourceLine}>
                          Fonte:{" "}
                          {s.fonte.url ? (
                            <a href={s.fonte.url} rel="noopener">
                              {s.fonte.orgao}
                            </a>
                          ) : (
                            s.fonte.orgao
                          )}{" "}
                          ({formatRef(s.fonte.ref, freq)})
                          {s.baseReal ? `; valor real, a preços de ${formatRef(s.baseReal, freq)}` : null}
                        </p>
                      </th>
                      {celula(pa, fmtMes(a))}
                      {celula(pb, fmtMes(b))}
                      <td data-rotulo="Diferença" className={styles.dif}>
                        {d ? (
                          d.seta === "=" ? (
                            "sem mudança"
                          ) : (
                            <Variacao as="span" texto={`${d.seta} ${d.texto}`} />
                          )
                        ) : (
                          "–"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className={styles.metodo}>
        Em cada data vale o último dado publicado até o fim do mês escolhido; o período de cada número aparece embaixo
        dele. Taxas mudam em pontos percentuais (p.p.); valores e índices, em %.
      </p>
    </div>
  );
}
