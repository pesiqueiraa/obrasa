// source-line (DESIGN.md): obrigatória sob todo número e todo gráfico.
// Curta (cartões e gráficos): "Fonte: IBGE (set/2026)". Na página do indicador também a
// data da última atualização: "Fonte: IBGE (set/2026), atualizado em 09/10/2026".
// O nome do órgão é link para a série na fonte; o código da série fica na metodologia.

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
      Fonte: {orgao} ({periodo ?? formatRef(refDate, series.frequencia)})
      {!curta && atualizadoEm ? `, atualizado em ${formatDate(atualizadoEm)}` : null}
    </p>
  );
}
