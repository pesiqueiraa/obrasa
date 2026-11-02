// source-line dos dados do TSE: "Fonte: TSE (25/10/2026)". O link leva à página do
// conjunto no Portal de Dados Abertos; arquivo e datas de geração e conferência ficam no
// atributo title e na metodologia (docs/05).

import { formatDate } from "@/lib/format";
import type { ArquivoTse, Coleta } from "@/lib/eleicoes";
import ui from "../ui.module.scss";

export function FonteTse({ arquivo, coleta, referencia }: { arquivo: ArquivoTse; coleta: Coleta | null; referencia: string }) {
  const detalhe = [
    `Dados Abertos do TSE, ${arquivo.membro}`,
    coleta?.geradoEm ? `gerado pelo TSE em ${formatDate(coleta.geradoEm)}` : null,
    coleta ? `conferido em ${formatDate(coleta.verificadoEm)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <p className={ui.sourceLine}>
      Fonte:{" "}
      <a href={arquivo.pagina} title={detalhe}>
        TSE
      </a>{" "}
      ({referencia})
    </p>
  );
}
