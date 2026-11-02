"use client";

// chart-panel (DESIGN.md): título; subtítulo com unidade e base; troca real/nominal em
// série monetária (regra 3); abas de janela; gráfico; source-line; "Ver tabela" e
// "Baixar CSV". Todo gráfico tem descrição em texto e tabela com os dados.

import {
  Button,
  ContentSwitcher,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
} from "@carbon/react";
import dynamic from "next/dynamic";
import { useId, useMemo, useState, type ReactNode } from "react";
import { formatNumber, formatRef, formatRefLong, formatValue, type FrequenciaRef } from "@/lib/format";
import { JANELAS, lastOfMonth, sliceWindow, type Janela } from "@/lib/indicator";
import styles from "./ui.module.scss";

const LineChart = dynamic(() => import("./LineChartClient"), {
  ssr: false,
  loading: () => <div className={styles.chart} aria-hidden="true" />,
});

export type Ponto = { refDate: string; value: number };

export type Variante = {
  id: string;
  rotulo: string; // "Real" / "Nominal"
  serieRotulo: string;
  subtitulo: string;
  obs: Ponto[];
  sourceLine: ReactNode;
};

export type ChartPanelProps = {
  titulo: string;
  unidade: string;
  casas: number;
  frequencia: FrequenciaRef;
  eixo: string;
  variantes: Variante[];
  janelaPadrao: Janela;
  csvHref: string;
};

export function ChartPanel(props: ChartPanelProps) {
  const { titulo, unidade, casas, frequencia, eixo, variantes, janelaPadrao, csvHref } = props;
  const [selected, setSelected] = useState(JANELAS.findIndex((j) => j.id === janelaPadrao));
  const [varIdx, setVarIdx] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  const janela = JANELAS[selected];
  const variante = variantes[varIdx];
  const windowObs = useMemo(() => sliceWindow(variante.obs, janela.id), [variante.obs, janela.id]);
  // Série diária em janela longa: último valor de cada mês, para o gráfico e a tabela.
  const mensalizar = frequencia === "diaria" && janela.id !== "12m";
  const pontos = useMemo(() => (mensalizar ? lastOfMonth(windowObs) : windowObs), [mensalizar, windowObs]);
  const refFreq: FrequenciaRef = mensalizar ? "mensal" : frequencia;
  const fmt = (n: number) => formatValue(n, unidade, casas);

  const first = windowObs[0];
  const last = windowObs[windowObs.length - 1];
  const min = windowObs.reduce((a, o) => (o.value < a.value ? o : a), first);
  const max = windowObs.reduce((a, o) => (o.value > a.value ? o : a), first);
  const descricao =
    `Gráfico de linha: ${variante.serieRotulo}, de ${formatRefLong(first.refDate, frequencia)} a ${formatRefLong(last.refDate, frequencia)}. ` +
    `Valor mais recente: ${fmt(last.value)}. ` +
    `Menor valor na janela: ${fmt(min.value)} em ${formatRef(min.refDate, frequencia)}; ` +
    `maior: ${fmt(max.value)} em ${formatRef(max.refDate, frequencia)}.`;

  return (
    <section className={styles.panel} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className={styles.panelTitle}>
        {titulo}
      </h2>
      <p className={styles.panelSubtitle}>{variante.subtitulo}</p>

      {variantes.length > 1 ? (
        <div className={styles.switcher}>
          <ContentSwitcher
            size="md"
            selectedIndex={varIdx}
            onChange={({ index }) => typeof index === "number" && setVarIdx(index)}
          >
            {variantes.map((v) => (
              <Switch key={v.id} name={v.id} text={v.rotulo} />
            ))}
          </ContentSwitcher>
        </div>
      ) : null}

      <div className={styles.tabsScroller}>
        <Tabs selectedIndex={selected} onChange={({ selectedIndex }) => setSelected(selectedIndex)}>
          <TabList aria-label="Janela de tempo">
            {JANELAS.map((j) => (
              <Tab key={j.id}>{j.rotulo}</Tab>
            ))}
          </TabList>
          <TabPanels>
            {JANELAS.map((j, i) => (
              <TabPanel key={j.id}>
                {i === selected ? (
                  <>
                    <p className="visually-hidden">{descricao}</p>
                    <div className={styles.chart}>
                      <LineChart
                        obs={pontos}
                        serieRotulo={variante.serieRotulo}
                        unidade={unidade}
                        casas={casas}
                        eixo={eixo}
                        frequencia={refFreq}
                        pontos={pontos.length <= 16}
                      />
                    </div>
                    {mensalizar ? (
                      <p className={styles.caption}>
                        Série diária: nesta janela, o gráfico e a tabela mostram o último valor de cada mês. O CSV
                        traz todos os dias.
                      </p>
                    ) : null}
                  </>
                ) : null}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </div>

      {variante.sourceLine}

      <div className={styles.actions}>
        <Button
          kind="tertiary"
          size="md"
          aria-expanded={showTable}
          aria-controls={`${id}-tabela`}
          onClick={() => setShowTable((s) => !s)}
        >
          {showTable ? "Esconder tabela" : "Ver tabela"}
        </Button>
        <Button as="a" kind="tertiary" size="md" href={csvHref} download>
          Baixar CSV
        </Button>
      </div>

      {showTable ? (
        <div id={`${id}-tabela`} className={styles.tableWrap}>
          <Table size="sm" aria-label={`${variante.serieRotulo}, janela de ${janela.rotulo}`}>
            <TableHead>
              <TableRow>
                <TableHeader>Referência</TableHeader>
                <TableHeader>Valor ({unidade})</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...pontos].reverse().map((o) => (
                <TableRow key={o.refDate}>
                  <TableCell>{formatRef(o.refDate, mensalizar ? "diaria" : frequencia)}</TableCell>
                  <TableCell>{formatNumber(o.value, casas)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
