// source-line (DESIGN.md): obrigatória sob todo número e todo gráfico.
// Completa: "Fonte: IBGE · SIDRA, tabela 1737, variável 2265 · ref. set/2026 · atualizado em 09/10/2026"
// Curta (cartões): "Fonte: IBGE · ref. set/2026 · atualizado em 09/10/2026"; o código da
// série fica na página do indicador. O nome do órgão é link para a fonte.

import { formatDate, formatRef } from "@/lib/format";
import { seriesUrl, type Series, type Source } from "@/lib/data";
import styles from "./ui.module.scss";

export function seriesDescriptor(source: Source, series: Series): string {
  if (source.id === "ibge_agregados") {
    const [tabela, variavel] = series.codigo_externo.split("/");
    const cls = series.classificacao ? `, classificação ${series.classificacao}` : "";
    return `SIDRA, tabela ${tabela}, variável ${variavel}${cls}`;
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
  curta?: boolean;
}) {
  const { source, series, refDate, atualizadoEm, periodo, curta } = props;
  const url = seriesUrl(source, series);
  const orgao = url ? (
    <a href={url} rel="noopener">
      {source.orgao}
    </a>
  ) : (
    source.orgao
  );
  return (
    <p className={styles.sourceLine}>
      Fonte: {orgao}
      {curta ? null : ` · ${seriesDescriptor(source, series)}`} · ref. {periodo ?? formatRef(refDate, series.frequencia)}
      {atualizadoEm ? ` · atualizado em ${formatDate(atualizadoEm)}` : null}
    </p>
  );
}
