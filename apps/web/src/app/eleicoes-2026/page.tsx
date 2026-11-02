// Eleições 2026 (docs/08, D13 a D15). Tudo vem dos arquivos de dados abertos do TSE,
// guardados e conferidos pelo job pipelines/jobs/eleicoes.py.
// Ordem: resultado do 2º turno → mapa → 1º turno → comparecimento → Congresso → UFs.

import type { Metadata } from "next";
import { Suspense } from "react";
import { Bancada } from "@/components/eleicoes/Bancada";
import { Comparecimento } from "@/components/eleicoes/Comparecimento";
import styles from "@/components/eleicoes/eleicoes.module.scss";
import { EleitosUf } from "@/components/eleicoes/EleitosUf";
import { FonteTse } from "@/components/eleicoes/FonteTse";
import { MapaPresidente } from "@/components/eleicoes/MapaPresidente";
import { NoticiasTema } from "@/components/noticias/NoticiasTema";
import { PrimeiroTurno, SegundoTurno, linhasDoTurno } from "@/components/eleicoes/Resultado";
import { TabelaUf } from "@/components/eleicoes/TabelaUf";
import { inteiro } from "@/components/eleicoes/util";
import tema from "@/components/tema.module.scss";
import ui from "@/components/ui.module.scss";
import { getEleicao } from "@/lib/eleicoes";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Eleições 2026",
  description: "Resultados das eleições de 2026 segundo o TSE: presidente por município, comparecimento e eleitos.",
};

async function Conteudo() {
  const e = await getEleicao();
  if (!e) {
    return (
      <div className="container section">
        <p>Os resultados ainda não foram coletados do TSE.</p>
      </div>
    );
  }
  const br = (t: 1 | 2) => e.apuracao.find((a) => a.turno === t && a.uf === "BR")!;
  const t1 = br(1);
  const t2 = br(2);
  const l1 = linhasDoTurno(e.candidatos, e.votos, 1);
  const l2 = linhasDoTurno(e.candidatos, e.votos, 2);
  const datas = `${formatDate(t1.data)} e ${formatDate(t2.data)}`;
  const candMapa = {
    1: l1.map((l) => ({ nr: l.c.nr, nome: l.c.nome, partido: l.c.partido })),
    2: l2.map((l) => ({ nr: l.c.nr, nome: l.c.nome, partido: l.c.partido })),
  };
  const bancada = (cargo: string) => e.partidos.filter((p) => p.cargo === cargo);

  return (
    <>
      <div className="container section">
        <header className={tema.cabecalho}>
          <h1>Eleições {e.ano}</h1>
          <p>
            Primeiro turno em {formatDate(t1.data)} e segundo turno em {formatDate(t2.data)}. Números totalizados pelo
            TSE, por município.
          </p>
        </header>
      </div>

      <div className="section section--surface">
        <div className="container">
          <section className={tema.destaque} aria-labelledby="presidente">
            <h2 id="presidente" className={tema.destaqueTitulo}>
              Presidente, 2º turno
            </h2>
            <p className={tema.destaqueSub}>
              Fatia dos {inteiro(t2.validos)} votos válidos de {formatDate(t2.data)}. Brancos e nulos não
              entram nos válidos.
            </p>
            <SegundoTurno linhas={l2} validos={t2.validos} turno={2} />
            <div className={tema.fontes}>
              <FonteTse arquivo={e.arquivos.votos_presidente} coleta={e.coletas.votos_presidente} referencia={formatDate(t2.data)} />
            </div>
          </section>
        </div>
      </div>

      <div className="container section">
        <section aria-labelledby="mapa">
          <h2 id="mapa" className={styles.secaoTitulo}>
            Por município
          </h2>
          <p className={styles.secaoSub}>
            Escolha o turno e o candidato. A cor é a fatia dos votos válidos dele em cada município, na mesma escala
            para todos.
          </p>
          <MapaPresidente candidatos={candMapa} />
          <details className={styles.detalhes}>
            <summary>Tabela por estado, 2º turno</summary>
            <TabelaUf turno={2} linhas={l2} votos={e.votos} apuracao={e.apuracao} />
          </details>
          <details className={styles.detalhes}>
            <summary>Tabela por estado, 1º turno</summary>
            <TabelaUf turno={1} linhas={l1} votos={e.votos} apuracao={e.apuracao} />
          </details>
          <FonteTse arquivo={e.arquivos.votos_presidente} coleta={e.coletas.votos_presidente} referencia={datas} />
          <p className={ui.sourceLine}>
            Mapa: <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3">IBGE</a> (malha municipal)
          </p>
        </section>
      </div>

      <div className="section section--surface">
        <div className="container">
          <section aria-labelledby="primeiro">
            <h2 id="primeiro" className={styles.secaoTitulo}>
              Presidente, 1º turno
            </h2>
            <p className={styles.secaoSub}>
              {l1.length} candidaturas, na ordem dos votos. Barras na escala de 0 a 100% dos{" "}
              {inteiro(t1.validos)} votos válidos de {formatDate(t1.data)}.
            </p>
            <PrimeiroTurno linhas={l1} validos={t1.validos} turno={1} />
            <FonteTse arquivo={e.arquivos.votos_presidente} coleta={e.coletas.votos_presidente} referencia={formatDate(t1.data)} />
          </section>
        </div>
      </div>

      <div className="container section">
        <section aria-labelledby="comparecimento">
          <h2 id="comparecimento" className={styles.secaoTitulo}>
            Comparecimento
          </h2>
          <p className={styles.secaoSub}>
            O que aconteceu com cada eleitor apto a votar para presidente, em cada turno, inclusive no exterior.
          </p>
          <Comparecimento turnos={[t1, t2]} />
          <FonteTse arquivo={e.arquivos.apuracao} coleta={e.coletas.apuracao} referencia={datas} />
        </section>
      </div>

      <div className="section section--surface">
        <div className="container">
          <section aria-labelledby="congresso">
            <h2 id="congresso" className={styles.secaoTitulo}>
              Congresso eleito
            </h2>
            <p className={styles.secaoSub}>
              Um quadrado por cadeira, por partido, do maior para o menor número de eleitos. Partidos de uma mesma
              federação aparecem separados, como no arquivo do TSE.
            </p>
            <div className={styles.bancadas}>
              <Bancada titulo="Câmara dos Deputados" partidos={bancada("DEPUTADO FEDERAL")} colunas={27} />
              <Bancada titulo="Senado, cadeiras em disputa em 2026" partidos={bancada("SENADOR")} colunas={9} />
            </div>
            <FonteTse arquivo={e.arquivos.candidatos} coleta={e.coletas.candidatos} referencia={formatDate(t1.data)} />
          </section>
        </div>
      </div>

      <div className="container section">
        <section aria-labelledby="ufs">
          <h2 id="ufs" className={styles.secaoTitulo}>
            Governadores e senadores eleitos
          </h2>
          <EleitosUf eleitos={e.eleitos} />
          <FonteTse arquivo={e.arquivos.candidatos} coleta={e.coletas.candidatos} referencia={datas} />
        </section>
        <NoticiasTema tema="eleicoes-2026" titulo="as eleições" />
      </div>
    </>
  );
}


export default function EleicoesPage() {
  return (
    <Suspense fallback={<div className="container section">Carregando resultados…</div>}>
      <Conteudo />
    </Suspense>
  );
}
