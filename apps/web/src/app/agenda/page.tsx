// Agenda (DESIGN.md, "Ferramentas"): quando saem os próximos dados. Datas do calendário
// oficial do IBGE e do calendário do Copom (Banco Central), lidas do banco.

import type { Metadata } from "next";
import { Suspense } from "react";
import { Calendario } from "@/components/ferramentas/Calendario";
import styles from "@/components/ferramentas/ferramentas.module.scss";
import tema from "@/components/tema.module.scss";
import { getAgenda } from "@/lib/agenda";

export const metadata: Metadata = {
  title: "Agenda",
  description: "Quando saem os próximos dados de inflação, emprego, PIB e as decisões do Copom.",
};

async function Conteudo() {
  const a = await getAgenda();
  return <Calendario {...a} />;
}

export default function AgendaPage() {
  return (
    <div className="container section">
      <header className={tema.cabecalho}>
        <h1>Agenda</h1>
        <p>Quando saem os próximos dados do IBGE e as decisões do Copom.</p>
      </header>
      <div className={styles.palco}>
        <Suspense fallback={<p>Carregando a agenda…</p>}>
          <Conteudo />
        </Suspense>
      </div>
      <p className={styles.metodo}>
        Datas do IBGE: calendário oficial de divulgações, lido todo dia pela coleta. Datas do Copom: calendário anual do
        Banco Central; as reuniões passadas são conferidas nos comunicados do BC.
      </p>
    </div>
  );
}
