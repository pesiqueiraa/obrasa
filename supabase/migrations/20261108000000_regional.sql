-- Mapas por estado (DESIGN.md, "mapa-uf"): valores do IBGE por Unidade da Federação.
-- Gravados por pipelines/jobs/regional.py a partir de config/regional.yaml. A série
-- nacional continua em observations; aqui só o recorte por UF de cada mapa.

create table observacoes_uf (
  mapa_id text not null,            -- id em config/regional.yaml
  source_id text not null references sources(id),
  codigo_externo text not null,     -- "4099/4099" ou "7113/10267"
  classificacao text,
  uf smallint not null check (uf between 11 and 53),
  uf_nome text not null,            -- nome da UF como a fonte publica
  ref_date date not null,
  value numeric not null,
  collected_at timestamptz not null,
  raw_object text not null,
  primary key (mapa_id, uf, ref_date)
);

create index observacoes_uf_ref on observacoes_uf (mapa_id, ref_date desc);

alter table observacoes_uf enable row level security;
create policy "leitura pública" on observacoes_uf for select using (true);
grant select on observacoes_uf to anon, authenticated;
