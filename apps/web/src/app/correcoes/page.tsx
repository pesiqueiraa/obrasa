import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCorrections } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Correções" };

async function CorrectionList() {
  const correcoes = await getCorrections();
  if (correcoes.length === 0) return <p>Nenhuma correção registrada até agora.</p>;
  return (
    <table className="simple-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Indicador</th>
          <th>O que estava errado e o que mudou</th>
        </tr>
      </thead>
      <tbody>
        {correcoes.map((c) => (
          <tr key={c.id}>
            <td>{formatDate(c.data)}</td>
            <td>
              {c.indicador_slug ? <Link href={`/indicador/${c.indicador_slug}`}>{c.indicador_slug}</Link> : "—"}
            </td>
            <td>
              {c.descricao}
              {c.antes || c.depois ? ` (antes: ${c.antes ?? "—"}; depois: ${c.depois ?? "—"})` : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CorrectionsPage() {
  return (
    <div className="container section">
      <div className="prose">
        <h1 className="display">Correções</h1>
        <p className="body-lg">
          Registro público de erros nossos: data, o que estava errado e o que mudou. Revisões feitas pelas próprias
          fontes aparecem na página de metodologia de cada indicador.
        </p>
        <Suspense fallback={<p>Carregando…</p>}>
          <CorrectionList />
        </Suspense>
      </div>
    </div>
  );
}
