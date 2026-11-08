// Auditor de tela: o número que a página mostra é o que está no banco?
//
// Uso (com o site rodando, ex.: `pnpm build && pnpm start`):
//   pnpm auditar-tela [http://localhost:3000]
//
// Para cada indicador, lê o banco direto (chave anônima, só leitura) e a página
// /indicador/<slug>, e confere no topo da página (IndicatorHero):
//   1. a série exibida é a principal, ou a reserva só quando a reserva é mais recente;
//   2. o período exibido é o último período dessa série no banco;
//   3. o valor exibido é o valor do banco, e o texto na tela traz esse número com as
//      casas decimais do indicador, no formato brasileiro;
//   4. a linha de fonte cita o órgão da série.
// Nada aqui reaproveita a lógica do site (src/lib): a regra é refeita a partir do banco,
// para que um erro no site não se esconda atrás do próprio site. Sai com 1 se algo
// divergir.

const SITE = (process.argv[2] ?? process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_ANON_KEY (node --env-file=.env.local ...).");
  process.exit(2);
}

async function rest(caminho) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

async function ultimo(seriesId) {
  const [o] = await rest(
    `observations_current?select=ref_date,value&series_id=eq.${seriesId}&order=ref_date.desc&limit=1`,
  );
  return o ?? null;
}

const decodifica = (s) =>
  s
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");

const atributo = (tag, nome) => new RegExp(`${nome}="([^"]*)"`).exec(tag)?.[1] ?? null;

const indicadores = await rest(
  "indicators?select=slug,series_id,fallback_series_id,casas_decimais,transformacao&order=ordem",
);
const series = Object.fromEntries((await rest("series?select=id,source_id")).map((s) => [s.id, s]));
const orgaos = Object.fromEntries((await rest("sources?select=id,orgao")).map((s) => [s.id, s.orgao]));

const erros = [];
let conferidos = 0;
for (const ind of indicadores) {
  const antes = erros.length;
  const falha = (msg) => erros.push(`${ind.slug}: ${msg}`);
  const principal = await ultimo(ind.series_id);
  const reserva = ind.fallback_series_id ? await ultimo(ind.fallback_series_id) : null;
  const usaReserva = reserva && (!principal || reserva.ref_date > principal.ref_date);
  const esperado = usaReserva ? reserva : principal;
  const esperadoId = usaReserva ? ind.fallback_series_id : ind.series_id;
  if (!esperado) {
    falha("sem observações no banco");
    continue;
  }

  const resp = await fetch(`${SITE}/indicador/${ind.slug}`);
  if (!resp.ok) {
    falha(`página respondeu HTTP ${resp.status}`);
    continue;
  }
  const html = await resp.text();
  const inicio = html.indexOf(`data-auditoria-indicador="${ind.slug}"`);
  if (inicio < 0) {
    falha("página sem o bloco do indicador (data-auditoria-indicador)");
    continue;
  }
  const secao = html.slice(inicio, html.indexOf("</section>", inicio));
  const tag = /<p[^>]*data-auditoria-serie="[^"]*"[^>]*>/.exec(secao)?.[0];
  if (!tag) {
    falha("página sem o valor marcado (data-auditoria-serie)");
    continue;
  }
  const serie = atributo(tag, "data-auditoria-serie");
  const ref = atributo(tag, "data-auditoria-ref");
  const valor = atributo(tag, "data-auditoria-valor");
  const fimP = secao.indexOf("</p>", secao.indexOf(tag));
  const texto = decodifica(secao.slice(secao.indexOf(tag) + tag.length, fimP));

  if (serie !== esperadoId) falha(`mostra a série ${serie}, o banco indica ${esperadoId}`);
  if (ref !== esperado.ref_date) falha(`mostra o período ${ref}, o último no banco é ${esperado.ref_date}`);
  // Transformação de exibição declarada no registro (docs/05): só a troca de sinal existe.
  const sinal = ind.transformacao === "inverter_sinal" ? -1 : 1;
  if (ind.transformacao && ind.transformacao !== "inverter_sinal")
    falha(`transformação desconhecida: ${ind.transformacao}`);
  const esperadoValor = sinal * Number(esperado.value);
  if (Number(valor) !== esperadoValor) falha(`mostra ${valor}, o banco tem ${esperado.value}`);
  const numero = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: ind.casas_decimais,
    maximumFractionDigits: ind.casas_decimais,
  }).format(Math.abs(esperadoValor));
  if (!texto.includes(numero)) falha(`texto na tela "${texto.trim()}" não traz ${numero}`);
  const orgao = orgaos[series[esperadoId]?.source_id];
  const fonte = /<p[^>]*>\s*Fonte:([\s\S]*?)<\/p>/.exec(secao);
  if (!fonte || !decodifica(fonte[1]).includes(orgao)) falha(`linha de fonte não cita ${orgao}`);

  if (erros.length > antes) continue;
  conferidos += 1;
  console.log(`${ind.slug}: ${numero} (${esperado.ref_date}, ${esperadoId})`);
}

console.log(`\n${conferidos} de ${indicadores.length} indicadores iguais ao banco na tela, ${erros.length} divergências.`);
for (const e of erros) console.error(`ERRO: ${e}`);
process.exit(erros.length ? 1 : 0);
