-- Agenda (DESIGN.md, "Ferramentas"): eventos com data marcada que não são divulgação de
-- série. As divulgações do IBGE já estão em releases.proxima_divulgacao. Aqui ficam as
-- reuniões do Copom (config/copom.yaml), gravadas por pipelines/jobs/agenda.py.

create table agenda_eventos (
  source_id text not null references sources(id),
  chave text not null,              -- ex.: 'copom-282'
  titulo text not null,
  inicio date not null,
  fim date not null check (fim >= inicio),
  url text check (url is null or url like 'https://%'),
  conferido_em timestamptz,         -- quando a data foi confirmada pela fonte (só eventos passados)
  raw_object text,
  primary key (source_id, chave)
);

create index agenda_eventos_fim on agenda_eventos (fim);

alter table agenda_eventos enable row level security;
create policy "leitura pública" on agenda_eventos for select using (true);
grant select on agenda_eventos to anon, authenticated;
