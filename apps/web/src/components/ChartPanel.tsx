"use client";

// chart-panel (DESIGN.md): título; subtítulo com unidade e base; abas de janela;
// gráfico; source-line; ações "Ver tabela" e "Baixar CSV". Todo gráfico tem
// descrição em texto e tabela com os dados (WCAG 2.2 AA, docs/04).

import {
  Button,
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
import { formatNumber, formatValue, monthLong, monthShort } from "@/lib/format";
import { JANELAS, sliceWindow, type Janela, type Obs } from "@/lib/indicator";
import styles from "./ui.module.scss";

const LineChart = dynamic(() => import("./LineChartClient"), {
  ssr: false,
  loading: () => <div className={styles.chart} aria-hidden="true" />,
});

export type ChartPanelProps = {
  titulo: string;
  subtitulo: string;
  serieRotulo: string;
  unidade: string;
  obs: Obs[];
  janelaPadrao: Janela;
  csvHref: string;
  sourceLine: ReactNode;
};

export function ChartPanel(props: ChartPanelProps) {
  const { titulo, subtitulo, serieRotulo, unidade, obs, janelaPadrao, csvHref, sourceLine } = props;
  const [selected, setSelected] = useState(JANELAS.findIndex((j) => j.id === janelaPadrao));
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const janela = JANELAS[selected];
  const windowObs = useMemo(() => sliceWindow(obs, janela.id), [obs, janela.id]);

  const first = windowObs[0];
  const last = windowObs[windowObs.length - 1];
  const min = windowObs.reduce((a, o) => (o.value < a.value ? o : a), first);
  const max = windowObs.reduce((a, o) => (o.value > a.value ? o : a), first);
  const descricao =
    `Gráfico de linha: ${serieRotulo}, de ${monthLong(first.refDate)} a ${monthLong(last.refDate)}. ` +
    `Valor mais recente: ${formatValue(last.value, unidade)}. ` +
    `Menor valor na janela: ${formatValue(min.value, unidade)} em ${monthShort(min.refDate)}; ` +
    `maior: ${formatValue(max.value, unidade)} em ${monthShort(max.refDate)}.`;

  return (
    <section className={styles.panel} aria-labelledby={`${tableId}-titulo`}>
      <h2 id={`${tableId}-titulo`} className={styles.panelTitle}>
        {titulo}
      </h2>
      <p className={styles.panelSubtitle}>{subtitulo}</p>

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
                      <LineChart obs={windowObs} serieRotulo={serieRotulo} unidade={unidade} pontos={j.id === "12m"} />
                    </div>
                  </>
                ) : null}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </div>

      {sourceLine}

      <div className={styles.actions}>
        <Button
          kind="tertiary"
          size="md"
          aria-expanded={showTable}
          aria-controls={`${tableId}-tabela`}
          onClick={() => setShowTable((s) => !s)}
        >
          {showTable ? "Esconder tabela" : "Ver tabela"}
        </Button>
        <Button as="a" kind="tertiary" size="md" href={csvHref} download>
          Baixar CSV
        </Button>
      </div>

      {showTable ? (
        <div id={`${tableId}-tabela`} className={styles.tableWrap}>
          <Table size="sm" aria-label={`${serieRotulo}, janela de ${janela.rotulo}`}>
            <TableHead>
              <TableRow>
                <TableHeader>Mês de referência</TableHeader>
                <TableHeader>Valor ({unidade})</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...windowObs].reverse().map((o) => (
                <TableRow key={o.refDate}>
                  <TableCell>{monthShort(o.refDate)}</TableCell>
                  <TableCell>{formatNumber(o.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
