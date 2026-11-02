// source-line (DESIGN.md): obrigatória sob todo número e todo gráfico.
// "Fonte: IBGE · SIDRA, tabela 1737, variável 2265 · ref. set/2026 · atualizado em 09/10/2026"
// O nome do órgão é link para a fonte; o resto é texto.

import { formatDate, monthShort } from "@/lib/format";
import type { Series, Source } from "@/lib/data";
import styles from "./ui.module.scss";

export function seriesDescriptor(source: Source, series: Series): string {
  if (source.id === "ibge_agregados") {
    const [tabela, variavel] = series.codigo_externo.split("/");
    return `SIDRA, tabela ${tabela}, variável ${variavel}`;
  }
  if (source.id === "bcb_sgs") return `SGS, série ${series.codigo_externo}`;
  return `${source.nome}, ${series.codigo_externo}`;
}

export function SourceLine(props: {
  source: Source;
  series: Series;
  refDate: string;
  atualizadoEm: string | null;
  periodo?: string;
}) {
  const { source, series, refDate, atualizadoEm, periodo } = props;
  const orgao = source.url_fonte ? (
    <a href={source.url_fonte} rel="noopener">
      {source.orgao}
    </a>
  ) : (
    source.orgao
  );
  return (
    <p className={styles.sourceLine}>
      Fonte: {orgao} · {seriesDescriptor(source, series)} · ref. {periodo ?? monthShort(refDate)}
      {atualizadoEm ? ` · atualizado em ${formatDate(atualizadoEm)}` : null}
    </p>
  );
}
