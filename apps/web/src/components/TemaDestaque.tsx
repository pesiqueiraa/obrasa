// Bloco próprio de cada tema (DESIGN.md, "Seções com elementos diferentes"): cada tema
// abre com uma visualização diferente, para a navegação entre temas não ficar repetitiva.
// Todos os números vêm das views do banco; abaixo de cada visualização, a linha de fonte
// de cada série usada (regra 2).

import type { IndicatorView } from "@/lib/data";
import { formatNumber, formatRef, formatValue, shiftMonths } from "@/lib/format";
import { lastOfMonth } from "@/lib/indicator";
import { SourceLine } from "./SourceLine";
import { JurosInflacao, type Ponto } from "./viz/JurosInflacao";
import { ProporcaoBarra } from "./viz/ProporcaoBarra";
import { Regua, type LinhaRegua } from "./viz/Regua";
import { Waffle } from "./viz/Waffle";
import styles from "./tema.module.scss";

function fontes(views: (IndicatorView | undefined)[]) {
  return views
    .filter((v): v is IndicatorView => !!v)
    .map((v) => (
      <SourceLine
        key={v.indicator.slug}
        source={v.exibida.source}
        series={v.exibida.series}
        refDate={v.exibida.obs[v.exibida.obs.length - 1].refDate}
        atualizadoEm={v.atualizadoEm}
      />
    ));
}

function mensal(v: IndicatorView, meses: number): Ponto[] {
  const obs = v.exibida.obs;
  const inicio = shiftMonths(obs[obs.length - 1].refDate, -meses);
  const janela = obs.filter((o) => o.refDate >= inicio);
  const pts = v.exibida.series.frequencia === "diaria" ? lastOfMonth(janela) : janela;
  return pts.map((o) => ({ ref: o.refDate.slice(0, 7), v: o.value }));
}

function Economia({ views }: { views: IndicatorView[] }) {
  const selic = views.find((v) => v.indicator.slug === "selic");
  const ipca = views.find((v) => v.indicator.slug === "ipca-12-meses");
  if (!selic || !ipca) return null;
  const s = mensal(selic, 120);
  const i = mensal(ipca, 120);
  const ls = selic.exibida.obs[selic.exibida.obs.length - 1];
  const li = ipca.exibida.obs[ipca.exibida.obs.length - 1];
  const descricao =
    `Meta Selic e IPCA em 12 meses, mês a mês, nos últimos 10 anos. ` +
    `Meta Selic: ${formatValue(ls.value, "% a.a.")} em ${formatRef(ls.refDate, "diaria")}. ` +
    `IPCA em 12 meses: ${formatValue(li.value, "%")} em ${formatRef(li.refDate, "mensal")}.`;
  return (
    <section className={styles.destaque} aria-labelledby="destaque-economia">
      <h2 id="destaque-economia" className={styles.destaqueTitulo}>
        Juros e inflação
      </h2>
      <p className={styles.destaqueSub}>
        Meta da taxa Selic e IPCA acumulado em 12 meses, em % ao ano, nos últimos 10 anos. Para a Selic, o valor do
        último dia de cada mês.
      </p>
      <JurosInflacao selic={s} ipca={i} descricao={descricao} />
      <div className={styles.fontes}>{fontes([selic, ipca])}</div>
    </section>
  );
}

function Trabalho({ views }: { views: IndicatorView[] }) {
  const deso = views.find((v) => v.indicator.slug === "desocupacao");
  const info = views.find((v) => v.indicator.slug === "informalidade");
  if (!deso) return null;
  const obs = deso.exibida.obs;
  const atual = obs[obs.length - 1];
  const antes = obs.find((o) => o.refDate === shiftMonths(atual.refDate, -12));
  const f = deso.exibida.series.frequencia;
  const ultInfo = info?.exibida.obs[info.exibida.obs.length - 1];
  return (
    <section className={styles.destaque} aria-labelledby="destaque-trabalho">
      <h2 id="destaque-trabalho" className={styles.destaqueTitulo}>
        De cada 100 pessoas na força de trabalho
      </h2>
      <p className={styles.destaqueSub}>
        Cada quadrado é uma pessoa de 14 anos ou mais que trabalha ou procura trabalho. Em azul, quem procurava e não
        tinha.
      </p>
      <div className={styles.waffles}>
        <Waffle
          value={atual.value}
          rotulo={`${formatNumber(atual.value, 1)} em ${formatRef(atual.refDate, f)}`}
        />
        {antes ? (
          <Waffle
            value={antes.value}
            rotulo={`${formatNumber(antes.value, 1)} um ano antes, em ${formatRef(antes.refDate, f)}`}
            apagado
          />
        ) : null}
      </div>
      {info && ultInfo ? (
        <div className={styles.bloco}>
          <h3 className={styles.blocoTitulo}>
            Entre quem trabalhava, no {formatRef(ultInfo.refDate, info.exibida.series.frequencia)}
          </h3>
          <ProporcaoBarra value={ultInfo.value} parte="na informalidade" resto="demais ocupados" />
        </div>
      ) : null}
      <div className={styles.fontes}>{fontes([deso, info])}</div>
    </section>
  );
}

function ContasPublicas({ views }: { views: IndicatorView[] }) {
  const linhas: LinhaRegua[] = views
    .filter((v) => v.exibida.series.unidade === "% do PIB")
    .map((v) => {
      const obs = v.exibida.obs;
      const f = v.exibida.series.frequencia;
      const last = obs[obs.length - 1];
      const min = obs.reduce((a, o) => (o.value < a.value ? o : a), obs[0]);
      const max = obs.reduce((a, o) => (o.value > a.value ? o : a), obs[0]);
      const t = (o: { value: number; refDate: string }) => `${formatNumber(o.value, 1)}% em ${formatRef(o.refDate, f)}`;
      return {
        slug: v.indicator.slug,
        titulo: v.indicator.titulo,
        valor: last.value,
        valorTexto: formatValue(last.value, "%", 1),
        ref: formatRef(last.refDate, f),
        min: { v: min.value, texto: t(min) },
        max: { v: max.value, texto: t(max) },
      };
    });
  if (linhas.length === 0) return null;
  return (
    <section className={styles.destaque} aria-labelledby="destaque-contas">
      <h2 id="destaque-contas" className={styles.destaqueTitulo}>
        Dívida em relação ao PIB
      </h2>
      <p className={styles.destaqueSub}>
        O PIB é tudo o que o país produz em um ano. A faixa cinza vai do menor ao maior valor de cada série; o traço
        azul é o valor mais recente.
      </p>
      <Regua linhas={linhas} />
      <div className={styles.fontes}>{fontes(views)}</div>
    </section>
  );
}

const DESTAQUES: Record<string, (p: { views: IndicatorView[] }) => React.ReactNode> = {
  economia: Economia,
  trabalho: Trabalho,
  "contas-publicas": ContasPublicas,
};

export function TemaDestaque({ tema, views }: { tema: string; views: IndicatorView[] }) {
  const C = DESTAQUES[tema];
  return C ? <C views={views} /> : null;
}
