-- Notícias por tema (docs/04, F5). Regra 7: só título, link, veículo, data e trecho curto.
-- Tabelas de config/noticias.yaml, gravadas por pipelines/jobs/noticias.py. Agrupamento
-- da mesma notícia em vários veículos (news_clusters, F6) e checagens ficam para depois.

create table outlets (
  id text primary key,
  nome text not null,
  dominio text not null
);

create table news_articles (
  id bigint generated always as identity primary key,
  outlet_id text not null references outlets(id),
  url text not null unique,
  titulo text not null,
  publicado_em timestamptz not null,
  trecho text check (trecho is null or char_length(trecho) <= 300),  -- nunca o texto da matéria
  temas text[] not null check (cardinality(temas) > 0),
  coletado_em timestamptz not null,
  raw_object text not null
);

create index news_articles_publicado_em on news_articles (publicado_em desc);
create index news_articles_temas on news_articles using gin (temas);

alter table outlets enable row level security;
alter table news_articles enable row level security;
create policy "leitura pública" on outlets for select using (true);
create policy "leitura pública" on news_articles for select using (true);
grant select on outlets, news_articles to anon, authenticated;
