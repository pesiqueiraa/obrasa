// Projetos sobre impostos em tramitação na Câmara (docs/10, 2.7). Separados do que já é
// lei e com o selo "Proposta, não é lei" (docs/02, seção 9). A ementa é a da Câmara, sem
// resumo nem comentário; a situação usa as palavras da própria Câmara.

import { formatDate } from "@/lib/format";
import type { Proposicao } from "@/lib/impostos";
import styles from "./impostos.module.scss";

const ABERTOS = 10;

function Item({ p }: { p: Proposicao }) {
  return (
    <li>
      <p className={styles.selo}>Proposta, não é lei</p>
      <h3>
        <a href={p.url} rel="noopener">
          {p.siglaTipo} {p.numero}/{p.ano}
        </a>
      </h3>
      <p>{p.ementa}</p>
      {p.situacao ? (
        <p className={styles.marcoMeta}>
          Situação: {p.situacao}
          {p.orgao ? ` (${p.orgao})` : ""}
          {p.ultimaTramitacao ? `, em ${formatDate(p.ultimaTramitacao)}` : ""}
        </p>
      ) : null}
    </li>
  );
}

export function Projetos({ projetos }: { projetos: Proposicao[] }) {
  if (projetos.length === 0) return <p>Nenhum projeto com tramitação nos últimos 30 dias.</p>;
  const coletado = projetos.reduce((a, p) => (p.coletadoEm > a ? p.coletadoEm : a), "");
  const resto = projetos.slice(ABERTOS);
  return (
    <>
      <ul className={styles.projetos}>
        {projetos.slice(0, ABERTOS).map((p) => (
          <Item key={p.id} p={p} />
        ))}
      </ul>
      {resto.length ? (
        <details className={styles.mais}>
          <summary className="toque">Ver mais {resto.length} projetos</summary>
          <ul className={styles.projetos}>
            {resto.map((p) => (
              <Item key={p.id} p={p} />
            ))}
          </ul>
        </details>
      ) : null}
      <p className={styles.sourceLine}>
        Fonte:{" "}
        <a href="https://dadosabertos.camara.leg.br/swagger/api.html" rel="noopener">
          Câmara dos Deputados
        </a>{" "}
        ({formatDate(coletado)})
      </p>
    </>
  );
}
