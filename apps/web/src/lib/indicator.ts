// Regras de exibição de um indicador. Funções puras: recebem linhas do banco e
// devolvem o que a tela mostra. Nenhum valor é criado aqui; só selecionado ou
// derivado de forma determinística de valores do banco (diferença na janela,
// R$ 100 corrigidos).

import { addDays, addMonths, formatDayMonth, formatNumber, monthShort } from "./format";

export type Janela = "12m" | "5a" | "10a" | "tudo";
export type Frequencia = "diaria" | "mensal" | "trimestral" | "anual" | "evento";

export const JANELAS: { id: Janela; rotulo: string; meses: number | null }[] = [
  { id: "12m", rotulo: "12 meses", meses: 12 },
  { id: "5a", rotulo: "5 anos", meses: 60 },
  { id: "10a", rotulo: "10 anos", meses: 120 },
  { id: "tudo", rotulo: "Tudo", meses: null },
];

export const FREQUENCIA_ROTULO: Record<Frequencia, string> = {
  diaria: "Diário",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  evento: "A cada reunião do Copom",
};

export type Obs = {
  refDate: string; // AAAA-MM-01
  value: number;
  revision: number;
  collectedAt: string;
  rawObject: string;
};

/** Observações dentro da janela: do mesmo mês N meses antes do último até o último. */
export function sliceWindow(obs: Obs[], janela: Janela): Obs[] {
  const def = JANELAS.find((j) => j.id === janela);
  if (!def) throw new Error(`janela desconhecida: ${janela}`);
  if (obs.length === 0 || def.meses === null) return obs;
  const start = addMonths(obs[obs.length - 1].refDate, -def.meses);
  return obs.filter((o) => o.refDate >= start);
}

export type Variacao = {
  direcao: "sobe" | "cai" | "estavel";
  diferenca: number; // p.p. para taxa, % para nível
  unidadeDiferenca: "p.p." | "%";
  base: Obs;
  atual: Obs;
};

/** Variação entre o primeiro e o último ponto da janela. */
export function variation(windowObs: Obs[], tipo: "taxa" | "nivel"): Variacao | null {
  if (windowObs.length < 2) return null;
  const base = windowObs[0];
  const atual = windowObs[windowObs.length - 1];
  const raw = tipo === "taxa" ? atual.value - base.value : (atual.value / base.value - 1) * 100;
  const diferenca = Math.round(raw * 100) / 100;
  const direcao = diferenca > 0 ? "sobe" : diferenca < 0 ? "cai" : "estavel";
  return { direcao, diferenca: Math.abs(diferenca), unidadeDiferenca: tipo === "taxa" ? "p.p." : "%", base, atual };
}

export function variationText(v: Variacao, janelaRotulo: string, formatBase: (n: number) => string): string {
  const desde = `${monthShort(v.base.refDate)}: ${formatBase(v.base.value)}`;
  if (v.direcao === "estavel") return `fica estável em ${janelaRotulo} (${desde})`;
  const seta = v.direcao === "sobe" ? "▲" : "▼";
  const dif = `${formatNumber(v.diferenca)}${v.unidadeDiferenca === "%" ? "%" : " p.p."}`;
  return `${seta} ${v.direcao} ${dif} em ${janelaRotulo} (${desde})`;
}

/** Usa a série reserva só se ela tiver período mais recente que a principal. */
export function chooseSeries<T extends { obs: Obs[] }>(primary: T, fallback: T | null): { escolhida: T; usandoReserva: boolean } {
  const lastP = primary.obs.at(-1)?.refDate ?? "";
  const lastF = fallback?.obs.at(-1)?.refDate ?? "";
  if (fallback && lastF > lastP) return { escolhida: fallback, usandoReserva: true };
  return { escolhida: primary, usandoReserva: false };
}

export type Release = { refDate: string; divulgadoEm: string | null; proximaDivulgacao: string | null };

/** Próxima divulgação agendada para um período posterior ao último disponível. */
export function nextRelease(releases: Release[], latestRef: string): Release | null {
  const upcoming = releases
    .filter((r) => r.refDate > latestRef && r.proximaDivulgacao)
    .sort((a, b) => (a.proximaDivulgacao! < b.proximaDivulgacao! ? -1 : 1));
  return upcoming[0] ?? null;
}

// Prazo usado quando a fonte não publica calendário: fim do mês seguinte ao de
// referência mais esta folga.
const FOLGA_SEM_CALENDARIO: Partial<Record<Frequencia, { meses: number; dias: number }>> = {
  mensal: { meses: 2, dias: 14 },
  trimestral: { meses: 4, dias: 14 },
};

export type Atraso = { atrasado: false } | { atrasado: true; desde: string; rotulo: string };

/**
 * O dado está atrasado se a divulgação esperada para o período seguinte já passou
 * (o dia seguinte à data do calendário) e o banco ainda não tem esse período.
 */
export function delayStatus(args: {
  latestRef: string;
  frequencia: Frequencia;
  proxima: Release | null;
  hoje: string;
}): Atraso {
  const { latestRef, frequencia, proxima, hoje } = args;
  let prazo: string | null = null;
  if (proxima?.proximaDivulgacao && proxima.refDate === addMonths(latestRef, 1)) {
    prazo = proxima.proximaDivulgacao;
  } else {
    const folga = FOLGA_SEM_CALENDARIO[frequencia];
    if (folga) prazo = addDays(addMonths(latestRef, folga.meses), folga.dias - 1);
  }
  if (!prazo) return { atrasado: false };
  const desde = addDays(prazo, 1);
  if (hoje < desde) return { atrasado: false };
  return { atrasado: true, desde, rotulo: `Atrasado desde ${formatDayMonth(desde)}` };
}
