import { Suspense } from "react";
import { IndicatorCard } from "@/components/IndicatorCard";
import { getIndicatorView, listIndicatorSlugs } from "@/lib/data";

async function Cards() {
  const slugs = await listIndicatorSlugs();
  const views = await Promise.all(slugs.map((s) => getIndicatorView(s)));
  return (
    <div>
      {views.map((v) =>
        v ? <IndicatorCard key={v.indicator.slug} view={v} href={`/indicador/${v.indicator.slug}`} /> : null,
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="container section">
      <h1 className="display">Dados oficiais do Brasil, com contexto e sem lado.</h1>
      <Suspense fallback={<p>Carregando indicadores…</p>}>
        <Cards />
      </Suspense>
    </div>
  );
}
