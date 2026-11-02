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

export function formatValue(value: number, unidade: string, decimals = 2): string {
  const n = formatNumber(value, decimals);
  if (unidade === "%") return `${n}%`;
  if (unidade.startsWith("R$")) return `R$ ${n}`;
  return `${n} ${unidade}`;
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
