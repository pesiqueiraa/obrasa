// Bloco 2 da aba Governos (docs/10, 3.7.1): meta de inflação do CMN ao lado do IPCA de
// dezembro, ano a ano, numa régua por ano (MetasGrafico), com o texto de cada ano. A carta
// aberta é o registro oficial do Banco Central quando a inflação fica fora do intervalo; o
// oBrasa cita o documento e não acrescenta veredito (docs/02, seção 10). As regras (quem
// fixa a meta, meta contínua) ficam na metodologia (/metodologia#governos).

import ui from "@/components/ui.module.scss";
import { seriesUrl } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/format";
import type { BlocoMetas, MetaInflacao } from "@/lib/governos";
import { MetasGrafico, type AnoMeta } from "./MetasGrafico";

const pct = (n: number) => `${formatNumber(n, 2)}%`;

function detalhe(m: MetaInflacao): string[] {
  const d = [m.normas[0]];
  if (m.metaOriginal !== null && m.normas[1]) d.push(`Mudou a meta de ${pct(m.metaOriginal)} da ${m.normas[1]}`);
  if (m.metaAjustada !== null && m.metaAjustada !== m.meta) d.push(`Meta ajustada pela carta aberta: ${pct(m.metaAjustada)}`);
  if (m.continua) d.push("Meta contínua, verificada mês a mês");
  return d;
}

export function Metas({ bloco }: { bloco: BlocoMetas }) {
  const { metas, ipca, fonteMetas } = bloco;
  if (metas.length === 0) return null;
  const anos: AnoMeta[] = metas.map((m) => ({
    ano: m.ano,
    meta: m.meta,
    inferior: m.inferior,
    superior: m.superior,
    ipca: m.ipcaDezembro,
    carta: m.cartaAberta && m.cartaUrl ? m.cartaUrl : null,
    detalhe: detalhe(m),
  }));
  const notas = [...new Set(metas.map((m) => m.nota).filter((n): n is string => n !== null))];
  const ipcaUrl = seriesUrl(ipca.source, ipca.series);
  return (
    <>
      <MetasGrafico anos={anos} />
      <p className={ui.sourceLine}>
        Fonte: meta e carta,{" "}
        {fonteMetas ? (
          <>
            <a href={fonteMetas.url} rel="noopener">
              {fonteMetas.orgao}
            </a>{" "}
            ({formatDate(fonteMetas.coletadoEm)})
          </>
        ) : (
          "Banco Central"
        )}
        ; IPCA,{" "}
        {ipcaUrl ? (
          <a href={ipcaUrl} rel="noopener">
            {ipca.source.orgao}
          </a>
        ) : (
          ipca.source.orgao
        )}{" "}
        (dez/{metas.filter((m) => m.ipcaDezembro !== null).at(-1)?.ano ?? metas[0].ano}).
      </p>
      {notas.map((n) => (
        <p key={n} className={ui.sourceLine}>
          Nota do Banco Central: “{n}”
        </p>
      ))}
    </>
  );
}
