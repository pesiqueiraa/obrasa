// Regras de exibição de um indicador. Funções puras: recebem linhas do banco e
// devolvem o que a tela mostra. Nenhum valor é criado aqui; só selecionado ou
// derivado de forma determinística de valores do banco (diferença na janela,
// R$ 100 corrigidos).

import { addDays, addMonths, formatDayMonth, formatNumber, formatRef, shiftMonths } from "./format";

export type Janela = "12m" | "5a" | "10a" | "tudo";
export type Frequencia = "diaria" | "mensal" | "trimestral_movel" | "trimestral" | "anual" | "evento";

export const JANELAS: { id: Janela; rotulo: string; meses: number | null }[] = [
  { id: "12m", rotulo: "12 meses", meses: 12 },
  { id: "5a", rotulo: "5 anos", meses: 60 },
  { id: "10a", rotulo: "10 anos", meses: 120 },
  { id: "tudo", rotulo: "Tudo", meses: null },
];

export const FREQUENCIA_ROTULO: Record<Frequencia, string> = {
  diaria: "Diário",
  mensal: "Mensal",
  trimestral_movel: "Mensal, trimestre móvel",
  trimestral: "Trimestral",
  anual: "Anual",
  evento: "Por evento",
};

export type Obs = {
  refDate: string; // AAAA-MM-DD; 1º dia do período, exceto em séries diárias
  value: number;
  revision: number;
  collectedAt: string;
  rawObject: string;
};

/** Observações dentro da janela: da mesma data N meses antes da última até a última. */
export function sliceWindow<T extends { refDate: string }>(obs: T[], janela: Janela): T[] {
  const def = JANELAS.find((j) => j.id === janela);
  if (!def) throw new Error(`janela desconhecida: ${janela}`);
  if (obs.length === 0 || def.meses === null) return obs;
  const start = shiftMonths(obs[obs.length - 1].refDate, -def.meses);
  return obs.filter((o) => o.refDate >= start);
}

/**
 * Pontos para desenhar uma série longa: em séries diárias, o último valor de cada mês
 * (valores do banco, sem média nem interpolação). As demais passam como estão.
 */
export function lastOfMonth<T extends { refDate: string }>(obs: T[]): T[] {
  const out: T[] = [];
  for (const o of obs) {
    if (out.length && out[out.length - 1].refDate.slice(0, 7) === o.refDate.slice(0, 7)) {
      out[out.length - 1] = o;
    } else {
      out.push(o);
    }
  }
  return out;
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

export function variationText(
  v: Variacao,
  janelaRotulo: string,
  formatBase: (n: number) => string,
  frequencia: Frequencia = "mensal",
): string {
  const desde = `${formatRef(v.base.refDate, frequencia)}: ${formatBase(v.base.value)}`;
  // Janela "Tudo": o período é o da série inteira, não um prazo.
  const periodo = janelaRotulo === "Tudo" ? "desde o início da série" : `em ${janelaRotulo}`;
  if (v.direcao === "estavel") return `fica estável ${periodo} (${desde})`;
  const seta = v.direcao === "sobe" ? "↑" : "↓"; // seta fina (DESIGN.md, "variation")
  const dif = `${formatNumber(v.diferenca)}${v.unidadeDiferenca === "%" ? "%" : " p.p."}`;
  return `${seta} ${v.direcao} ${dif} ${periodo} (${desde})`;
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

// Prazo usado quando a fonte não publica calendário: o 1º dia do período de referência
// mais esta folga. Séries diárias: 5 dias corridos (fim de semana e feriado). Uma série
// pode declarar a própria folga (`prazo` em config/sources.yaml). A mesma regra está em
// pipelines/jobs/atrasos.py, que alerta o time: mudou aqui, mude lá.
const FOLGA_SEM_CALENDARIO: Partial<Record<Frequencia, { meses: number; dias: number }>> = {
  diaria: { meses: 0, dias: 5 },
  mensal: { meses: 2, dias: 14 },
  trimestral_movel: { meses: 2, dias: 14 },
  trimestral: { meses: 6, dias: 14 },
  // PNAD Contínua anual (educação): o ano N sai em junho de N+1. Do 1º dia do último ano
  // publicado até o prazo do seguinte: 2025 → 14/07/2027.
  anual: { meses: 30, dias: 14 },
};

// Distância, em meses, entre um período e o seguinte.
export const PASSO_MESES: Partial<Record<Frequencia, number>> = {
  mensal: 1,
  trimestral_movel: 1,
  trimestral: 3,
  anual: 12,
};

/**
 * Pontos do gráfico com os períodos que a fonte não publicou marcados como lacuna, para a
 * linha ser interrompida ali em vez de ligar os vizinhos. Compara só ano e mês: a série
 * diária resumida por mês cai no último dia útil (29/08, 30/09…), e isso não é lacuna.
 */
export function lacunas<T extends { refDate: string }>(
  obs: T[],
  passo: number | undefined,
): ((T & { lacuna: false }) | { refDate: string; lacuna: true })[] {
  const out: ((T & { lacuna: false }) | { refDate: string; lacuna: true })[] = [];
  const mes = (r: string) => r.slice(0, 7);
  obs.forEach((o, i) => {
    if (passo && i > 0) {
      for (let r = addMonths(obs[i - 1].refDate, passo); mes(r) < mes(o.refDate); r = addMonths(r, passo)) {
        out.push({ refDate: r, lacuna: true });
      }
    }
    out.push({ ...o, lacuna: false });
  });
  return out;
}

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
  folga?: { meses: number; dias: number };
}): Atraso {
  const { latestRef, frequencia, proxima, hoje } = args;
  let prazo: string | null = null;
  const passo = PASSO_MESES[frequencia];
  if (proxima?.proximaDivulgacao && passo && proxima.refDate === addMonths(latestRef, passo)) {
    prazo = proxima.proximaDivulgacao;
  } else {
    const folga = args.folga ?? FOLGA_SEM_CALENDARIO[frequencia];
    if (folga) {
      const base = frequencia === "diaria" ? latestRef : addMonths(latestRef, folga.meses);
      prazo = addDays(base, folga.dias - 1);
    }
  }
  if (!prazo) return { atrasado: false };
  const desde = addDays(prazo, 1);
  if (hoje < desde) return { atrasado: false };
  return { atrasado: true, desde, rotulo: `Atrasado desde ${formatDayMonth(desde)}` };
}
