// Formatação no padrão brasileiro (DESIGN.md, "Typography"): vírgula decimal,
// ponto de milhar, % colado ao número, datas como "set/2026" e "10/10/2026".

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TZ = "America/Sao_Paulo";

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Valor com unidade no padrão brasileiro: "4,58%", "13,75% a.a.", "R$ 3.811", "R$ 5,4212". */
export function formatValue(value: number, unidade: string, decimals = 2): string {
  const n = formatNumber(value, decimals);
  if (unidade === "%") return `${n}%`;
  if (unidade.startsWith("% ")) return `${n}${unidade}`; // "% a.a.", "% do PIB"
  if (unidade === "R$" || unidade === "R$/US$") return `R$ ${n}`;
  if (unidade.startsWith("R$ ")) return `R$ ${n} ${unidade.slice(3)}`; // "R$ bilhões"
  if (unidade === "índice") return n;
  return `${n} ${unidade}`;
}

export type FrequenciaRef = "diaria" | "mensal" | "trimestral_movel" | "trimestral" | "anual" | "evento";

/** "2026-09-01" → [2026, 9, 1]. */
export function parseDay(ref: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ref);
  if (!m) throw new Error(`data fora do formato AAAA-MM-DD: ${ref}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Período de referência, curto: "30/10/2026", "set/2026", "jul–set/2026", "3º tri/2026". */
export function formatRef(ref: string, freq: FrequenciaRef = "mensal"): string {
  const [y, m, d] = parseDay(ref);
  switch (freq) {
    case "diaria":
      return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    case "trimestral_movel":
      return `${MESES_CURTOS[(m + 9) % 12]}–${MESES_CURTOS[m - 1]}/${m >= 3 ? y : `${y - 1}–${y}`}`;
    case "trimestral":
      return `${Math.floor((m - 1) / 3) + 1}º tri/${y}`;
    case "anual":
      return String(y);
    default:
      return `${MESES_CURTOS[m - 1]}/${y}`;
  }
}

/** Período por extenso: "30 de outubro de 2026", "julho a setembro de 2026", "3º trimestre de 2026". */
export function formatRefLong(ref: string, freq: FrequenciaRef = "mensal"): string {
  const [y, m, d] = parseDay(ref);
  switch (freq) {
    case "diaria":
      return `${d} de ${MESES[m - 1]} de ${y}`;
    case "trimestral_movel": {
      const ini = (m + 9) % 12;
      return m >= 3 ? `${MESES[ini]} a ${MESES[m - 1]} de ${y}` : `${MESES[ini]} de ${y - 1} a ${MESES[m - 1]} de ${y}`;
    }
    case "trimestral":
      return `${Math.floor((m - 1) / 3) + 1}º trimestre de ${y}`;
    case "anual":
      return String(y);
    default:
      return `${MESES[m - 1]} de ${y}`;
  }
}

/** Soma meses mantendo o dia (limitado ao fim do mês): 2026-03-31 − 1 mês = 2026-02-28. */
export function shiftMonths(ref: string, delta: number): string {
  const [y, m, d] = parseDay(ref);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** "2026-09-01" → [2026, 9] sem passar por Date (evita deslocamento de fuso). */
export function parseRef(ref: string): [number, number] {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(ref);
  if (!m) throw new Error(`ref_date fora do formato AAAA-MM-DD: ${ref}`);
  return [Number(m[1]), Number(m[2])];
}

export function monthShort(ref: string): string {
  const [y, m] = parseRef(ref);
  return `${MESES_CURTOS[m - 1]}/${y}`;
}

export function monthLong(ref: string): string {
  const [y, m] = parseRef(ref);
  return `${MESES[m - 1]} de ${y}`;
}

export function addMonths(ref: string, delta: number): string {
  const [y, m] = parseRef(ref);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-01`;
}

/** Data (AAAA-MM-DD ou timestamp ISO) → "09/10/2026", no fuso de Brasília. */
export function formatDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

/** "dd/mm" para o chip de atraso. */
export function formatDayMonth(isoDate: string): string {
  return formatDate(isoDate).slice(0, 5);
}

/** Hoje (AAAA-MM-DD) no fuso de Brasília. */
export function todayInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
