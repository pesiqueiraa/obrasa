// CSV para download (docs/04, F0): cabeçalho com fonte, série, unidade e data de coleta.
// Valores com ponto decimal e separador vírgula, para abrir em qualquer ferramenta.

import type { Obs } from "./indicator";

export type CsvMeta = {
  titulo: string;
  orgao: string;
  fonteNome: string;
  urlFonte: string | null;
  seriesId: string;
  codigoExterno: string;
  serieNome: string;
  unidade: string;
  urlPagina: string;
  /** Linha extra no cabeçalho, ex.: transformação aplicada na exibição. */
  nota?: string;
};

function cell(value: string): string {
  return /[",\n#]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCsv(meta: CsvMeta, obs: Obs[]): string {
  const lastCollected = obs.reduce((acc, o) => (o.collectedAt > acc ? o.collectedAt : acc), "");
  const header = [
    `# ${meta.titulo}`,
    `# Fonte: ${meta.orgao}, ${meta.fonteNome}${meta.urlFonte ? ` (${meta.urlFonte})` : ""}`,
    `# Série: ${meta.serieNome} (código na fonte: ${meta.codigoExterno}; series_id: ${meta.seriesId})`,
    `# Unidade: ${meta.unidade}`,
    `# Data da coleta mais recente: ${lastCollected}`,
    `# Revisão vigente de cada período; o histórico de revisões está na página de metodologia.`,
    `# Página: ${meta.urlPagina}`,
    ...(meta.nota ? [`# ${meta.nota}`] : []),
  ];
  const rows = obs.map((o) =>
    [o.refDate, String(o.value), meta.unidade, meta.seriesId, String(o.revision), o.collectedAt, o.rawObject]
      .map(cell)
      .join(","),
  );
  return [...header, "data_referencia,valor,unidade,series_id,revisao,coletado_em,resposta_bruta", ...rows].join("\n") + "\n";
}
