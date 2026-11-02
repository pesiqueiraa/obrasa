// Brasil hoje (home). O quadro mostra o indicador principal de cada tema, alinhado
// como num painel de instrumentos; os demais ficam na página do tema. Depois, a
// agenda das próximas divulgações oficiais.

import Link from "next/link";
import { Suspense } from "react";
import { FrequencyChip } from "@/components/FrequencyChip";
import { SourceLine } from "@/components/SourceLine";
import { Sparkline } from "@/components/viz/Sparkline";
import styles from "@/components/home.module.scss";
import { getTemas, getTemaViews, type IndicatorView } from "@/lib/data";
import { formatDate, formatRef, parseDay } from "@/lib/format";
import { present } from "@/lib/present";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function Linha({ tema, titulo, resumo, views, i }: { tema: string; titulo: string; resumo: string; views: IndicatorView[]; i: number }) {
  const lead = views[0];
  if (!lead) return null;
  const p = present(lead);
  const s = lead.exibida.series;
  return (
    <li className={styles.linha}>
      <div className={styles.tema}>
        <h2>
          <Link href={`/${tema}`}>{titulo}</Link>
        </h2>
        <p>{resumo}</p>
        <Link href={`/${tema}`} className={styles.mais}>
          {views.length} {views.length === 1 ? "indicador" : "indicadores"}
        </Link>
      </div>
      <div className={styles.numero}>
        <p className={styles.rotulo}>
          <Link href={`/indicador/${lead.indicator.slug}`}>{lead.indicator.titulo}</Link>
          <FrequencyChip frequencia={s.frequencia} atraso={lead.atraso} />
        </p>
        <p className={styles.valor}>
          {p.fmt(p.latest.value)}
          <span className="visually-hidden"> em {formatRef(p.latest.refDate, s.frequencia)}</span>
        </p>
        {p.baseReal ? <p className={styles.nota}>{p.baseReal}</p> : null}
        {p.variacao ? <p className={styles.variacao}>{p.variacao}</p> : null}
      </div>
      <div className={styles.tendencia}>
        <Sparkline values={p.spark} width={220} height={64} delay={0.15 + i * 0.12} />
      </div>
      <div className={styles.fonte}>
        <SourceLine
          source={lead.exibida.source}
          series={s}
          refDate={p.latest.refDate}
          atualizadoEm={lead.atualizadoEm}
          curta
        />
      </div>
    </li>
  );
}

type Item = { data: string; slug: string; titulo: string; ref: string; orgao: string };

function Agenda({ itens }: { itens: Item[] }) {
  if (itens.length === 0) return null;
  const porData = new Map<string, Item[]>();
  for (const it of itens) porData.set(it.data, [...(porData.get(it.data) ?? []), it]);
  return (
    <section aria-labelledby="agenda" className={styles.agenda}>
      <h2 id="agenda" className={styles.agendaTitulo}>
        Próximas divulgações
      </h2>
      <p className={styles.agendaSub}>Datas dos calendários oficiais coletados. Os números entram aqui no dia em que saem.</p>
      <ol>
        {[...porData.entries()].map(([data, grupo]) => {
          const [y, m, d] = parseDay(data);
          return (
            <li key={data} className={styles.dia}>
              <time dateTime={data} className={styles.data}>
                <span className={styles.diaNum}>{d}</span>
                <span>
                  {MESES[m - 1]} {y}
                </span>
              </time>
              <ul>
                {grupo.map((it) => (
                  <li key={it.slug}>
                    <Link href={`/indicador/${it.slug}`}>{it.titulo}</Link>
                    <span>
                      {it.orgao}, ref. {it.ref}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

async function Quadro() {
  const temas = await getTemas();
  const porTema = await Promise.all(temas.map(async (t) => ({ t, views: await getTemaViews(t.slug) })));
  const todas = porTema.flatMap((x) => x.views);
  const coletadoAte = todas
    .map((v) => v.exibida.obs[v.exibida.obs.length - 1].collectedAt)
    .sort()
    .at(-1);
  const orgaos = [...new Set(todas.map((v) => v.principal.source.orgao))].sort();
  const agenda: Item[] = todas
    .filter((v) => v.proxima?.proximaDivulgacao)
    .map((v) => ({
      data: v.proxima!.proximaDivulgacao!,
      slug: v.indicator.slug,
      titulo: v.indicator.titulo,
      ref: formatRef(v.proxima!.refDate, v.principal.series.frequencia),
      orgao: v.principal.source.orgao,
    }))
    .sort((a, b) => (a.data === b.data ? a.titulo.localeCompare(b.titulo) : a.data < b.data ? -1 : 1));

  return (
    <>
      <div className="container">
        <header className={styles.topo}>
          <h1>Brasil hoje</h1>
          <p>
            {todas.length} indicadores oficiais, de {orgaos.join(" e ")}
            {coletadoAte ? `, com dados coletados até ${formatDate(coletadoAte)}` : ""}.
          </p>
        </header>
        <ol className={styles.quadro}>
          {porTema.map(({ t, views }, i) => (
            <Linha key={t.slug} tema={t.slug} titulo={t.titulo} resumo={t.resumo} views={views} i={i} />
          ))}
        </ol>
      </div>
      <div className="section section--surface">
        <div className="container">
          <Agenda itens={agenda} />
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="container section">Carregando…</div>}>
      <Quadro />
    </Suspense>
  );
}
