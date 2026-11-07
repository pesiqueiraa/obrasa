-- Aba Impostos e "o que vem por aí" (docs/10, 2.1 e 2.7).
--
-- 1. indicators.focus: nome do indicador no Focus do Banco Central, quando ele o cobre.
-- 2. expectativas: medianas do Focus por indicador, data da pesquisa e ano de referência
--    (pipelines/jobs/focus.py). Só INSERT: a pesquisa de cada semana fica guardada.
-- 3. proposicoes: projetos sobre impostos com tramitação recente na Câmara
--    (pipelines/jobs/camara.py). A lista é trocada a cada coleta.
-- 4. marcos_tributarios: linha do tempo da reforma e do IR, copiada de config/impostos.yaml
--    (pipelines/jobs/impostos.py). A tela só mostra marco com conferido_em preenchido.
-- As séries de arrecadação usam series/observations, como as demais.

alter table indicators add column focus text;

create table expectativas (
  source_id text not null references sources(id),
  indicador text not null,               -- como no Focus, ex.: 'IPCA'
  data_pesquisa date not null,
  ano_referencia int not null check (ano_referencia between 2000 and 2100),
  mediana numeric not null,
  respondentes int check (respondentes is null or respondentes > 0),
  base_calculo int not null check (base_calculo in (0, 1)),
  coletado_em timestamptz not null,
  raw_object text not null,
  primary key (indicador, data_pesquisa, ano_referencia, base_calculo)
);

create index expectativas_recentes on expectativas (indicador, data_pesquisa desc);

alter table expectativas enable row level security;
create policy "leitura pública" on expectativas for select using (true);
grant select on expectativas to anon, authenticated;
revoke update, delete, truncate on expectativas from coletor;

create table proposicoes (
  source_id text not null references sources(id),
  id int primary key,                    -- id da proposição na API da Câmara
  sigla_tipo text not null check (sigla_tipo in ('PEC', 'PLP', 'PL')),
  numero int not null,
  ano int not null,
  ementa text not null,
  situacao text,
  orgao text,                            -- onde está agora (sigla)
  ultima_tramitacao timestamptz,
  url text not null check (url like 'https://%'),
  coletado_em timestamptz not null,
  raw_object text not null
);

create index proposicoes_recentes on proposicoes (ultima_tramitacao desc);

alter table proposicoes enable row level security;
create policy "leitura pública" on proposicoes for select using (true);
grant select on proposicoes to anon, authenticated;

create table marcos_tributarios (
  source_id text not null references sources(id),
  id text primary key,
  vigencia date not null,
  publico text[] not null check (publico <@ array['pf', 'pj'] and cardinality(publico) > 0),
  titulo text not null,
  texto text not null,
  lei text not null,
  url text not null check (url like 'https://www.planalto.gov.br/%'),
  conferido_por text,
  conferido_em date,
  check ((conferido_por is null) = (conferido_em is null))
);

create index marcos_vigencia on marcos_tributarios (vigencia);

alter table marcos_tributarios enable row level security;
create policy "leitura pública" on marcos_tributarios for select using (true);
grant select on marcos_tributarios to anon, authenticated;
