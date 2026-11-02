-- Modelo de dados da Fundação (F0), conforme docs/06-arquitetura.md.
-- As tabelas de notícias (outlets, news_articles, news_clusters, fact_checks)
-- entram numa migração futura.
--
-- Ajustes em relação ao modelo sugerido em docs/06:
--   * sources.url_fonte: link exibido na linha de fonte.
--   * indicators.url_metodologia e indicators.verificacao.
--   * releases ganha chave primária (series_id, ref_date).
--   * checks de domínio (frequência, tipo, janela) e de não negatividade da revisão.
--   * view observations_current: a revisão mais recente de cada período.

create table sources (
  id text primary key,                -- ex.: 'bcb_sgs', 'ibge_agregados'
  nome text not null,
  orgao text not null,
  url_fonte text,
  url_documentacao text,
  url_metodologia text,
  licenca text
);

create table series (
  id text primary key,                -- ex.: 'bcb_sgs_432'
  source_id text not null references sources(id),
  codigo_externo text not null,       -- código na fonte (432, '1737/2265'...)
  nome text not null,
  unidade text not null,
  frequencia text not null check (frequencia in ('diaria', 'mensal', 'trimestral', 'anual', 'evento')),
  tipo text not null check (tipo in ('nivel', 'taxa')),
  monetaria boolean not null default false,
  inicio date,
  nota_metodologia text,
  unique (source_id, codigo_externo)
);

create table observations (
  series_id text not null references series(id),
  ref_date date not null,             -- primeiro dia do período de referência
  value numeric not null,
  revision int not null default 0 check (revision >= 0),  -- revisões da fonte criam nova linha
  collected_at timestamptz not null,
  raw_object text not null,           -- caminho da resposta bruta no Storage
  primary key (series_id, ref_date, revision),
  check (extract(day from ref_date) = 1)
);

create index observations_series_ref_idx on observations (series_id, ref_date desc, revision desc);

create table indicators (
  slug text primary key,
  titulo text not null,
  series_id text not null references series(id),
  fallback_series_id text references series(id),
  transformacao text,                 -- ex.: 'acumulado_12m', 'real_ipca'
  verificacao text,                   -- ex.: 'acumulado_12m_encadeado'
  janela_padrao text not null check (janela_padrao in ('12m', '5a', '10a', 'tudo')),
  frase_template text not null,
  url_metodologia text,
  ordem int
);

create table releases (
  series_id text not null references series(id),
  ref_date date not null,
  divulgado_em timestamptz,
  proxima_divulgacao date,
  primary key (series_id, ref_date)
);

create table corrections (
  id bigserial primary key,
  data timestamptz not null default now(),
  indicador_slug text references indicators(slug),
  descricao text not null,
  antes text,
  depois text
);

-- Revisão vigente de cada período. A tela usa sempre esta view; o histórico
-- completo continua em observations (revisões nunca são apagadas).
create view observations_current
with (security_invoker = true) as
select distinct on (series_id, ref_date)
  series_id, ref_date, value, revision, collected_at, raw_object
from observations
order by series_id, ref_date, revision desc;

-- Leitura pública, escrita só pelo pipeline (service role ou conexão direta).
alter table sources enable row level security;
alter table series enable row level security;
alter table observations enable row level security;
alter table indicators enable row level security;
alter table releases enable row level security;
alter table corrections enable row level security;

create policy "leitura publica" on sources for select to anon, authenticated using (true);
create policy "leitura publica" on series for select to anon, authenticated using (true);
create policy "leitura publica" on observations for select to anon, authenticated using (true);
create policy "leitura publica" on indicators for select to anon, authenticated using (true);
create policy "leitura publica" on releases for select to anon, authenticated using (true);
create policy "leitura publica" on corrections for select to anon, authenticated using (true);

grant select on observations_current to anon, authenticated;

-- Bucket privado para as respostas brutas das fontes.
insert into storage.buckets (id, name, public)
values ('raw', 'raw', false)
on conflict (id) do nothing;
