-- Eleições 2026 (docs/08, D14 e D15). Resultados do TSE (dados abertos) e malhas do IBGE.
--
-- Nada é sobrescrito: cada coleta em que os dados mudaram vira uma linha em
-- eleicao_coletas, e os resultados apontam para ela. As views *_atual leem só a coleta
-- mais recente de cada arquivo. Um arquivo regenerado pelo TSE sem mudança nos números
-- não cria coleta nova; só atualiza verificado_em.

create table municipios (
  ibge int primary key,
  nome text not null,
  uf char(2) not null,
  cd_tse text unique,
  -- como o código do TSE foi casado com o do IBGE: pelo nome na mesma UF, ou pela lista
  -- de exceções revisada em config/eleicoes.yaml
  casamento_tse text check (casamento_tse in ('nome', 'excecao'))
);

create table eleicao_coletas (
  id bigint generated always as identity primary key,
  arquivo text not null,            -- ex.: detalhe_votacao_munzona_2026_BR.csv
  url text not null,                -- zip de onde o arquivo foi lido
  gerado_em timestamptz,            -- DT_GERACAO e HH_GERACAO do próprio arquivo
  conteudo_sha256 text not null,    -- hash dos números gravados (não do arquivo inteiro)
  raw_object text not null,
  coletado_em timestamptz not null,
  verificado_em timestamptz not null,
  unique (arquivo, conteudo_sha256)
);

-- Comparecimento e votos por município (soma das zonas, inclusive voto em trânsito).
create table eleicao_apuracao (
  coleta_id bigint not null references eleicao_coletas (id),
  cd_eleicao int not null,
  turno smallint not null check (turno in (1, 2)),
  data_eleicao date not null,
  cargo text not null,
  uf char(2) not null,              -- ZZ = exterior
  cd_municipio_tse text not null,
  nome_municipio_tse text not null,
  aptos int not null check (aptos >= 0),
  comparecimento int not null check (comparecimento >= 0),
  abstencoes int not null check (abstencoes >= 0),
  -- eleitores de seções que não foram instaladas (no arquivo de 2026, só no exterior):
  -- são aptos, mas não contam como comparecimento nem como abstenção
  aptos_secoes_nao_instaladas int not null check (aptos_secoes_nao_instaladas >= 0),
  validos int not null check (validos >= 0),
  brancos int not null check (brancos >= 0),
  nulos int not null check (nulos >= 0),
  primary key (coleta_id, turno, cargo, cd_municipio_tse),
  check (aptos = comparecimento + abstencoes + aptos_secoes_nao_instaladas),
  check (comparecimento = validos + brancos + nulos)
);

-- Votos válidos por candidato e município (soma das zonas).
create table eleicao_votos (
  coleta_id bigint not null references eleicao_coletas (id),
  turno smallint not null check (turno in (1, 2)),
  cargo text not null,
  uf char(2) not null,
  cd_municipio_tse text not null,
  nr_candidato int not null,
  votos int not null check (votos >= 0),
  primary key (coleta_id, turno, cargo, cd_municipio_tse, nr_candidato)
);

-- Candidaturas, só com o que a página mostra. CPF, e-mail, título de eleitor, data de
-- nascimento e demais dados pessoais do arquivo do TSE não são lidos.
create table eleicao_candidatos (
  coleta_id bigint not null references eleicao_coletas (id),
  turno smallint not null check (turno in (1, 2)),
  cargo text not null,
  uf char(2) not null,              -- BR para presidente
  sq_candidato text not null,
  nr_candidato int not null,
  nome_urna text not null,
  sg_partido text not null,
  sg_federacao text,
  situacao text not null,           -- DS_SIT_TOT_TURNO, com as palavras do TSE
  primary key (coleta_id, turno, sq_candidato)
);

create table malhas (
  id text not null,                 -- ex.: br_municipios
  conteudo_sha256 text not null,
  url text not null,
  formato text not null,
  conteudo jsonb not null,
  raw_object text not null,
  coletado_em timestamptz not null,
  primary key (id, conteudo_sha256)
);

create view eleicao_coletas_atual with (security_invoker = true) as
  select distinct on (arquivo) * from eleicao_coletas order by arquivo, coletado_em desc;

create view eleicao_apuracao_atual with (security_invoker = true) as
  select a.* from eleicao_apuracao a join eleicao_coletas_atual c on c.id = a.coleta_id;

create view eleicao_votos_atual with (security_invoker = true) as
  select v.* from eleicao_votos v join eleicao_coletas_atual c on c.id = v.coleta_id;

create view eleicao_candidatos_atual with (security_invoker = true) as
  select k.* from eleicao_candidatos k join eleicao_coletas_atual c on c.id = k.coleta_id;

create view malhas_atual with (security_invoker = true) as
  select distinct on (id) * from malhas order by id, coletado_em desc;

-- Totais por turno, cargo e UF (a linha uf = 'BR' é o total do país, com o exterior).
create view eleicao_apuracao_uf with (security_invoker = true) as
  select turno, cargo, data_eleicao, uf,
         sum(aptos)::bigint aptos, sum(comparecimento)::bigint comparecimento,
         sum(abstencoes)::bigint abstencoes,
         sum(aptos_secoes_nao_instaladas)::bigint aptos_secoes_nao_instaladas,
         sum(validos)::bigint validos, sum(brancos)::bigint brancos, sum(nulos)::bigint nulos
  from eleicao_apuracao_atual group by turno, cargo, data_eleicao, uf
  union all
  select turno, cargo, data_eleicao, 'BR',
         sum(aptos), sum(comparecimento), sum(abstencoes), sum(aptos_secoes_nao_instaladas),
         sum(validos), sum(brancos), sum(nulos)
  from eleicao_apuracao_atual group by turno, cargo, data_eleicao;

create view eleicao_votos_uf with (security_invoker = true) as
  select turno, cargo, uf, nr_candidato, sum(votos)::bigint votos
  from eleicao_votos_atual group by turno, cargo, uf, nr_candidato
  union all
  select turno, cargo, 'BR', nr_candidato, sum(votos)
  from eleicao_votos_atual group by turno, cargo, nr_candidato;

create view eleicao_eleitos_partido with (security_invoker = true) as
  select cargo, sg_partido, count(*)::int eleitos
  from eleicao_candidatos_atual
  where situacao like 'ELEITO%'
  group by cargo, sg_partido;

-- Mapa: uma linha por município e turno, com os votos de cada candidato em jsonb.
-- Numa função, para a página buscar tudo numa requisição (a API limita linhas por página).
-- Os votos são agregados uma vez (group by), e não município a município: a versão com
-- join lateral sobre as views levava 30 s e estourava o tempo limite do papel anon.
create or replace function eleicao_mapa(p_cargo text) returns jsonb
language sql stable security invoker set search_path = public as $$
  with c as (select id from eleicao_coletas_atual),
  v as (
    select x.turno, x.cd_municipio_tse, jsonb_object_agg(x.nr_candidato::text, x.votos) votos
    from eleicao_votos x
    where x.coleta_id in (select id from c) and x.cargo = p_cargo
    group by x.turno, x.cd_municipio_tse
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           't', a.turno, 'm', m.ibge, 'n', m.nome, 'uf', m.uf, 'val', a.validos, 'v', v.votos)
         order by a.turno, m.ibge), '[]'::jsonb)
  from eleicao_apuracao a
  join municipios m on m.cd_tse = a.cd_municipio_tse
  join v on v.turno = a.turno and v.cd_municipio_tse = a.cd_municipio_tse
  where a.coleta_id in (select id from c) and a.cargo = p_cargo;
$$;

alter table municipios enable row level security;
alter table eleicao_coletas enable row level security;
alter table eleicao_apuracao enable row level security;
alter table eleicao_votos enable row level security;
alter table eleicao_candidatos enable row level security;
alter table malhas enable row level security;

create policy "leitura publica" on municipios for select to anon, authenticated using (true);
create policy "leitura publica" on eleicao_coletas for select to anon, authenticated using (true);
create policy "leitura publica" on eleicao_apuracao for select to anon, authenticated using (true);
create policy "leitura publica" on eleicao_votos for select to anon, authenticated using (true);
create policy "leitura publica" on eleicao_candidatos for select to anon, authenticated using (true);
create policy "leitura publica" on malhas for select to anon, authenticated using (true);

grant select on eleicao_coletas_atual, eleicao_apuracao_atual, eleicao_votos_atual,
  eleicao_candidatos_atual, malhas_atual, eleicao_apuracao_uf, eleicao_votos_uf,
  eleicao_eleitos_partido to anon, authenticated;
grant execute on function eleicao_mapa(text) to anon, authenticated;
