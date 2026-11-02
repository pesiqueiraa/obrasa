import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getIndicatorView, listIndicatorSlugs } from "@/lib/data";

export const metadata: Metadata = { title: "Metodologia" };

async function IndicatorList() {
  const slugs = await listIndicatorSlugs();
  const views = await Promise.all(slugs.map((s) => getIndicatorView(s)));
  return (
    <ul>
      {views.map((v) =>
        v ? (
          <li key={v.indicator.slug}>
            <Link href={`/metodologia/${v.indicator.slug}`} className="toque">{v.indicator.titulo}</Link>
          </li>
        ) : null,
      )}
    </ul>
  );
}

export default function MethodologyIndex() {
  return (
    <div className="container section">
      <div className="prose">
        <h1 className="display">Metodologia</h1>
        <p className="body-lg">
          Só usamos dados de órgãos públicos que produzem o dado. Todo número mostra a fonte, a data de referência, a
          data de atualização e a frequência. Nenhum número é gerado ou estimado por inteligência artificial.
        </p>
        <h2>Metodologia por indicador</h2>
        <Suspense fallback={<p>Carregando…</p>}>
          <IndicatorList />
        </Suspense>
      </div>
    </div>
  );
}
