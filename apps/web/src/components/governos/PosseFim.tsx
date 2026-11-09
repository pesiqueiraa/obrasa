// Bloco 1 da aba Governos (docs/10, 3.7.1): os mesmos indicadores para todos os mandatos,
// do último dado antes da posse ao último do mandato. Um cartão por indicador: os dois
// números, a diferença (seta fina, cor neutra; Variacao), a linha do caminho entre eles e a
// fonte curta (regra 2). Série monetária mostra o valor real com o mês-base (regra 3). O
// aviso de que a diferença não prova causa é fixo (docs/02, seção 10). As regras de escolha
// dos pontos ficam na metodologia (/metodologia#governos).

import Link from "next/link";
import { Variacao } from "@/components/Variacao";
import ui from "@/components/ui.module.scss";
import { seriesUrl } from "@/lib/data";
import { formatNumber, formatRef, formatValue } from "@/lib/format";
import type { BlocoPosseFim, LinhaIndicador, Mandato } from "@/lib/governos";
import { LinhaMandato } from "./LinhaMandato";
import styles from "./governos.module.scss";

function diferenca(l: LinhaIndicador): string {
  const v = l.variacao!;
  const casas = v.unidade === "%" ? 1 : l.casas;
  const n = formatNumber(Math.abs(v.valor), casas);
  if (Number(n.replace(/\./g, "").replace(",", ".")) === 0) return "sem mudança";
  return `${v.valor > 0 ? "↑" : "↓"} ${n}${v.unidade === "%" ? "%" : " p.p."}`;
}

function Cartao({ l, base, i, colFim }: { l: LinhaIndicador; base: string; i: number; colFim: string }) {
  const { unidade, monetaria } = l.bundle.series;
  const fmt = (n: number) => formatValue(n, unidade, l.casas);
  // "% do PIB" e "% a.a." vão para o título; o número fica só com "%", numa linha.
  const unidadeNoTitulo = unidade.startsWith("% ") ? unidade.slice(2) : null;
  const curto = (n: number) => (unidadeNoTitulo ? `${formatNumber(n, l.casas)}%` : fmt(n));
  const posse = l.posse!;
  const fim = l.fim!;
  const valor = (p: typeof posse) => curto(monetaria && p.real !== null ? p.real : p.value);
  const url = seriesUrl(l.bundle.source, l.bundle.series);
  return (
    <article className={styles.cartao} id={`ind-${l.id}`}>
      <h3 className={styles.cartaoTitulo}>
        {l.titulo}
        {unidadeNoTitulo ? <span className={styles.ref}>em % {unidadeNoTitulo}</span> : null}
      </h3>
      <dl className={styles.pontas}>
        <div>
          <dt>Antes da posse</dt>
          <dd>
            <span className={styles.valor}>{valor(posse)}</span>
            <span className={styles.ref}>{formatRef(posse.refDate, l.freq)}</span>
          </dd>
        </div>
        <div>
          <dt>{colFim}</dt>
          <dd>
            <span className={styles.valor}>{valor(fim)}</span>
            <span className={styles.ref}>{formatRef(fim.refDate, l.freq)}</span>
          </dd>
        </div>
      </dl>
      <Variacao as="p" texto={`${diferenca(l)}${monetaria ? " no valor real" : ""}`} />
      <LinhaMandato
        valores={l.trajeto.map((p) => p.value)}
        rotulos={l.trajeto.map((p) => `${formatRef(p.refDate, l.freq === "diaria" ? "mensal" : l.freq)}: ${curto(p.value)}`)}
        delay={0.08 * i}
      />
      <p className={ui.sourceLine}>
        Fonte: {url ? <a href={url} rel="noopener">{l.bundle.source.orgao}</a> : l.bundle.source.orgao} (
        {formatRef(fim.refDate, l.freq)})
        {monetaria ? `. Real a preços de ${formatRef(base)}; nominal ${fmt(posse.value)} e ${fmt(fim.value)}` : null}
      </p>
    </article>
  );
}

export function PosseFim({ m, bloco }: { m: Mandato; bloco: BlocoPosseFim }) {
  const colFim = m.fim === null ? "Último dado" : "Fim do mandato";
  return (
    <>
      <p className={styles.aviso}>
        A diferença entre os dois números não prova que o governo causou a mudança.{" "}
        <Link href="/metodologia#governos">Como os pontos são escolhidos</Link>
      </p>
      <div className={styles.cartoes}>
        {bloco.linhas.map((l, i) => (
          <Cartao key={l.id} l={l} base={bloco.base} i={i} colFim={colFim} />
        ))}
      </div>
    </>
  );
}
