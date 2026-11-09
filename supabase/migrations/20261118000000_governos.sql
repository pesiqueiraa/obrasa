-- Aba Governos (docs/10, 3.7.1; decisão D27), blocos 1 e 2.
--
-- 1. mandatos: presidentes desde 1995, copiados de config/governos.yaml pelo job governos
--    (pipelines/jobs/governos.py) só depois de conferidos: cada prova (trecho da
--    Constituição no normas.leg.br ou da página da matéria no Senado) precisa estar
--    literalmente no texto citado. A lista é trocada inteira; se a conferência falhar, a
--    lista anterior fica.
-- 2. metas_inflacao: meta do CMN por ano, lida da página de histórico de metas do Banco
--    Central, com o IPCA efetivo e a carta aberta que a página registra. A coleta confere o
--    IPCA da página contra o IPCA de dezembro do banco (IBGE 1737/2265) e recusa gravar se
--    divergir. Desde 2025 a meta é contínua (apurada mês a mês): `continua` e sem IPCA anual.
-- Os indicadores do bloco 1 usam series/observations, como os demais.

create table mandatos (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  ordem int not null unique,
  presidente text not null,
  rotulo text not null,
  inicio date not null unique,
  fim date,                                -- null: em curso
  nota text,
  provas jsonb not null,                   -- [{trecho, urn, versao} | {trecho, url}]
  -- retrato oficial no Wikimedia Commons, carregado de lá (não copiado): {url, pagina, autor, licenca}
  foto jsonb not null check (
    foto->>'url' ~ '^https://(upload|thumb)\.wikimedia\.org/'
    and foto->>'pagina' ~ '^https://commons\.wikimedia\.org/'
  ),
  conferido_em date not null,
  raw_objects text[] not null,             -- respostas brutas lidas na conferência
  check (fim is null or fim >= inicio)
);

alter table mandatos enable row level security;
create policy "leitura pública" on mandatos for select using (true);
grant select on mandatos to anon, authenticated;

create table metas_inflacao (
  source_id text not null references sources(id),
  ano int primary key check (ano between 1999 and 2100),
  continua boolean not null,
  meta numeric not null,
  tolerancia numeric not null check (tolerancia > 0),
  inferior numeric not null,
  superior numeric not null,
  normas text[] not null,                  -- da mais recente para a original
  meta_original numeric,                   -- quando uma resolução posterior mudou a meta
  meta_ajustada numeric,                   -- meta ajustada por carta aberta (2003 e 2004)
  nota text,                               -- nota da página que explica o ajuste, literal
  ipca_efetivo numeric,                    -- null na meta contínua
  carta_aberta boolean,                    -- null na meta contínua (a página não registra)
  carta_url text check (carta_url is null or carta_url like 'https://www.bcb.gov.br/%'),
  coletado_em timestamptz not null,
  raw_object text not null,
  check (inferior < meta and meta < superior),
  check (continua = (ipca_efetivo is null))
);

alter table metas_inflacao enable row level security;
create policy "leitura pública" on metas_inflacao for select using (true);
grant select on metas_inflacao to anon, authenticated;

-- Bloco 4: emendas à Constituição e leis complementares (lista de legislação do Senado).
-- Trocada inteira a cada coleta, só depois de conferida a numeração (job governos).
create table normas_federais (
  source_id text not null references sources(id),
  tipo text not null check (tipo in ('EMC', 'LCP')),
  numero int not null check (numero > 0),
  data date not null,
  nome text not null,
  ementa text not null check (ementa <> ''),
  url text not null check (url like 'https://normas.leg.br/?urn=urn:lex:br:federal:%'),
  impostos boolean not null,
  coletado_em timestamptz not null default now(),
  raw_objects text[] not null,
  primary key (tipo, numero)
);

create index normas_federais_data on normas_federais (data);

alter table normas_federais enable row level security;
create policy "leitura pública" on normas_federais for select using (true);
grant select on normas_federais to anon, authenticated;

-- Bloco 3: plano de governo registrado no TSE pela candidatura eleita e os trechos com
-- número localizados pelo agente localizar_promessas e conferidos por código na página.
-- `hash`: do PDF, do prompt, do modelo e da lista de indicadores; igual, o agente não roda.
create table planos (
  mandato text primary key,
  ano int not null check (ano >= 2010),
  sq_candidato text not null,
  arquivo text not null,
  url_pacote text not null check (url_pacote like 'https://cdn.tse.jus.br/%'),
  paginas int not null check (paginas > 0),
  hash text not null,
  versao_prompt text not null,
  modelo text not null,
  custo_usd numeric,
  conferido_em date not null,
  raw_object text not null
);

create table planos_trechos (
  mandato text not null references planos(mandato) on delete cascade,
  ordem int not null,
  pagina int not null check (pagina > 0),
  trecho text not null check (trecho ~ '[0-9]'),
  indicador text,
  primary key (mandato, ordem)
);

alter table planos enable row level security;
alter table planos_trechos enable row level security;
create policy "leitura pública" on planos for select using (true);
create policy "leitura pública" on planos_trechos for select using (true);
grant select on planos, planos_trechos to anon, authenticated;
