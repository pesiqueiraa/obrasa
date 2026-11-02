// Brasil hoje (home). Um número por tema, com a variação curta ("↓ 0,59 p.p. em 12
// meses"); a comparação completa aparece ao passar o mouse ou focar a linha, e a
// minilinha mostra cada período ao passar o dedo. Embaixo, as próximas datas da agenda.

import Link from "next/link";
import { Suspense } from "react";
import { FonteTse } from "@/components/eleicoes/FonteTse";
import { linhasDoTurno } from "@/components/eleicoes/Resultado";
import { nomeProprio, pct } from "@/components/eleicoes/util";
import { FrequencyChip } from "@/components/FrequencyChip";
import { SourceLine } from "@/components/SourceLine";
import { Variacao } from "@/components/Variacao";
import { Sparkline } from "@/components/viz/Sparkline";
import styles from "@/components/home.module.scss";
import ui from "@/components/ui.module.scss";
import { getTemas, getTemaViews, type IndicatorView } from "@/lib/data";
import { getEleicao } from "@/lib/eleicoes";
import { formatDate, formatRef, parseDay } from "@/lib/format";
import { present } from "@/lib/present";

/** "↓ cai 0,59 p.p. em 12 meses (set/2025: 5,17%)" → curta "↓ 0,59 p.p. em 12 meses" e a base. */
function partes(variacao: string): { curta: string; base: string | null } {
  const m = /^(↑|↓) (?:sobe|cai) (.+?) \((.+)\)$/.exec(variacao);
  if (m) return { curta: `${m[1]} ${m[2]}`, base: m[3] };
  const e = /^fica estável (.+?) \((.+)\)$/.exec(variacao);
  if (e) return { curta: `= estável ${e[1]}`, base: e[2] };
  return { curta: variacao, base: null };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function Linha({ tema, titulo, views, i }: { tema: string; titulo: string; views: IndicatorView[]; i: number }) {
  const lead = views[0];
  if (!lead) return null;
  const p = present(lead);
  const s = lead.exibida.series;
  const v = p.variacao ? partes(p.variacao) : null;
  return (
    <li className={styles.linha}>
      <h2 className={styles.tema}>
        <Link href={`/${tema}`}>{titulo}</Link>
      </h2>
      <div className={styles.numero}>
        <p className={styles.rotulo}>
          <Link href={`/indicador/${lead.indicator.slug}`}>{lead.indicator.titulo}</Link>
          <FrequencyChip frequencia={s.frequencia} atraso={lead.atraso} />
        </p>
        <p className={styles.valor}>
          {p.fmt(p.latest.value)}
          <span className={styles.ref}>{formatRef(p.latest.refDate, s.frequencia)}</span>
        </p>
        {v ? (
          <Variacao texto={v.curta} className={styles.variacao}>
            {v.base ? <span className={styles.detalhe}> (antes: {v.base})</span> : null}
          </Variacao>
        ) : null}
        {p.baseReal ? <p className={styles.nota}>{p.baseReal}</p> : null}
      </div>
      <div className={styles.tendencia}>
        <Sparkline values={p.spark} rotulos={p.sparkRotulos} width={220} height={56} delay={0.15 + i * 0.12} />
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

// Linha da eleição no quadro: o resultado do 2º turno para presidente, com a barra
// dividida em miniatura no lugar da sparkline.
async function LinhaEleicao({ tema, titulo }: { tema: string; titulo: string }) {
  const e = await getEleicao();
  if (!e) return null;
  const t2 = e.apuracao.find((a) => a.turno === 2 && a.uf === "BR");
  if (!t2) return null;
  const [a, b] = linhasDoTurno(e.candidatos, e.votos, 2);
  return (
    <li className={styles.linha}>
      <h2 className={styles.tema}>
        <Link href={`/${tema}`}>{titulo}</Link>
      </h2>
      <div className={styles.numero}>
        <p className={styles.rotulo}>
          <Link href={`/${tema}`}>Presidente, 2º turno</Link>
          <span className={ui.chip}>Por eleição</span>
        </p>
        <p className={styles.valor}>{pct(a.votos, t2.validos)}</p>
        <p className={styles.variacao}>
          {nomeProprio(a.c.nome)} ({a.c.partido}), {a.c.situacao[2]?.toLowerCase() ?? ""}
          <span className={styles.detalhe}>
            {" "}
            ; {nomeProprio(b.c.nome)} ({b.c.partido}): {pct(b.votos, t2.validos)}
          </span>
        </p>
      </div>
      <div className={styles.tendencia} aria-hidden="true">
        <div className={styles.miniDuelo}>
          <span style={{ width: `${(a.votos / t2.validos) * 100}%` }} />
        </div>
      </div>
      <div className={styles.fonte}>
        <FonteTse arquivo={e.arquivos.votos_presidente} coleta={e.coletas.votos_presidente} referencia={formatDate(t2.data)} />
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
      <ol>
        {[...porData.entries()].slice(0, 4).map(([data, grupo]) => {
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
      <Link href="/agenda" className={styles.agendaMais}>
        Agenda completa, com as reuniões do Copom
      </Link>
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

  const temEleicao = porTema.some(({ t }) => t.slug === "eleicoes-2026") && (await getEleicao()) !== null;

  return (
    <>
      <div className="container">
        <header className={styles.topo}>
          <h1>Brasil hoje</h1>
          <p>
            Um número por tema, de {orgaos.join(", ")}
            {temEleicao ? " e TSE" : ""}
            {coletadoAte ? `. Coleta até ${formatDate(coletadoAte)}` : ""}.
          </p>
        </header>
        <ol className={styles.quadro}>
          {porTema.map(({ t, views }, i) =>
            t.slug === "eleicoes-2026" ? (
              <LinhaEleicao key={t.slug} tema={t.slug} titulo={t.titulo} />
            ) : (
              <Linha key={t.slug} tema={t.slug} titulo={t.titulo} views={views} i={i} />
            ),
          )}
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
