"use client";

// Calculadora da inflação (DESIGN.md, "Ferramentas"). Quanto um valor em reais de um mês
// equivale em outro mês, pelo número-índice do IPCA (IBGE, tabela 1737):
//   valor × índice do mês de destino ÷ índice do mês de origem.
// A pessoa compara quantos valores e datas quiser (ex.: R$ 2.000 em 2015 e R$ 2.000 em
// 2020). O estado fica no endereço da página, para dar para compartilhar a conta.

import { motion } from "motion/react";
import { useId, useState } from "react";
import { formatNumber, formatRef } from "@/lib/format";
import { leValor } from "@/lib/contas";
import type { IndiceIpca } from "@/lib/ferramentas";
import { Fonte } from "./Fonte";
import { SeletorMes } from "./SeletorMes";
import styles from "./ferramentas.module.scss";

export type Linha = { id: number; valor: string; mes: string };

const MAX_LINHAS = 6;

const reais = (n: number) => `R$ ${formatNumber(n, 2)}`;
const mesRef = (mes: string) => formatRef(`${mes}-01`);

export function Calculadora({ indice, inicial }: { indice: IndiceIpca; inicial: { linhas: Linha[]; base: string } }) {
  const tabela = new Map(indice.pontos);
  const meses = indice.pontos.map(([m]) => m);
  const [linhas, setLinhas] = useState(inicial.linhas);
  const [base, setBase] = useState(inicial.base);
  const idBase = useId();

  function grava(novas: Linha[], novaBase: string) {
    setLinhas(novas);
    setBase(novaBase);
    const v = novas.map((l) => `${leValor(l.valor) ?? 0}_${l.mes}`).join(",");
    window.history.replaceState(null, "", `?v=${v}&base=${novaBase}`);
  }
  const muda = (id: number, campo: Partial<Linha>) =>
    grava(
      linhas.map((l) => (l.id === id ? { ...l, ...campo } : l)),
      base,
    );

  const contas = linhas.map((l) => {
    const valor = leValor(l.valor);
    const de = tabela.get(l.mes);
    const para = tabela.get(base);
    if (valor == null || de == null || para == null) return { l, valor, corrigido: null, variacao: null };
    return { l, valor, corrigido: (valor * para) / de, variacao: (para / de - 1) * 100 };
  });
  const maior = Math.max(...contas.map((c) => c.corrigido ?? 0), 1);
  const [a, b] = contas;

  return (
    <div className={styles.calc}>
      <div className={styles.baseLinha}>
        <label htmlFor={idBase}>Valores corrigidos para</label>
        <SeletorMes id={idBase} meses={meses} valor={base} onChange={(m) => grava(linhas, m)} rotulo="Mês de destino" />
      </div>

      <ol className={styles.linhas}>
        {contas.map(({ l, valor, corrigido, variacao }, i) => (
          <li key={l.id} className={styles.linha}>
            <div className={styles.entrada}>
              <label className={styles.campoValor}>
                <span className="visually-hidden">Valor {i + 1}, em reais</span>
                <span aria-hidden="true">R$</span>
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={l.valor}
                  onChange={(e) => muda(l.id, { valor: e.target.value })}
                  aria-invalid={valor == null}
                />
              </label>
              <span className={styles.em}>em</span>
              <SeletorMes meses={meses} valor={l.mes} onChange={(m) => muda(l.id, { mes: m })} rotulo={`Mês do valor ${i + 1}`} />
              {linhas.length > 1 ? (
                <button
                  type="button"
                  className={styles.remover}
                  onClick={() =>
                    grava(
                      linhas.filter((x) => x.id !== l.id),
                      base,
                    )
                  }
                  aria-label={`Remover valor ${i + 1}`}
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className={styles.resultado} aria-live="polite">
              {corrigido == null || variacao == null ? (
                <p className={styles.aviso}>Digite um valor em reais, como 2.000 ou 2.000,50.</p>
              ) : (
                <>
                  <p className={styles.equivale}>
                    equivale a <strong>{reais(corrigido)}</strong> em {mesRef(base)}
                  </p>
                  <div className={styles.barraFundo} aria-hidden="true">
                    <motion.div
                      className={styles.barra}
                      initial={false}
                      animate={{ scaleX: corrigido / maior }}
                      transition={{ type: "spring", stiffness: 220, damping: 30 }}
                    />
                  </div>
                  <p className={styles.detalhe}>
                    IPCA acumulado de {mesRef(l.mes)} a {mesRef(base)}: {variacao >= 0 ? "+" : ""}
                    {formatNumber(variacao, 2)}%
                  </p>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      {linhas.length < MAX_LINHAS ? (
        <button
          type="button"
          className={styles.adicionar}
          onClick={() =>
            grava(
              [...linhas, { id: Math.max(...linhas.map((l) => l.id)) + 1, valor: linhas.at(-1)?.valor ?? "1.000", mes: base }],
              base,
            )
          }
        >
          + Adicionar outro valor
        </button>
      ) : null}

      {a?.corrigido && b?.corrigido && a.valor != null && b.valor != null ? (
        <p className={styles.comparacao}>
          A preços de {mesRef(base)}, {reais(a.valor)} de {mesRef(a.l.mes)} equivalem a {reais(a.corrigido)} e{" "}
          {reais(b.valor)} de {mesRef(b.l.mes)}, a {reais(b.corrigido)}: diferença de {reais(Math.abs(a.corrigido - b.corrigido))}
          .
        </p>
      ) : null}

      <Fonte fonte={indice.fonte}>
        Conta: valor × número-índice do IPCA do mês de destino ÷ número-índice do mês de origem. Disponível desde
        jul/1994, início do real.
      </Fonte>
    </div>
  );
}
