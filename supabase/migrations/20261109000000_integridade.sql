-- Integridade dos dados (docs/06, "Revisões" e "Falhas").
--
-- 1. Tabelas de dado só aceitam INSERT. Até aqui a regra "revisão vira linha nova, nunca
--    sobrescreve" existia só no Python; agora o banco recusa UPDATE, DELETE e TRUNCATE
--    nessas tabelas, venha de onde vier (pipeline, SQL manual no painel, script).
--    Corrigir um dado é gravar uma revisão nova. Se um dia for preciso apagar algo de
--    verdade, é uma decisão explícita: `alter table ... disable trigger ...` numa
--    migração revisada, com registro em `corrections`.
--
-- 2. Papel `coletor` para o pipeline. db.connect() faz `set role coletor` em toda conexão,
--    então o pipeline não tem permissão de mudar o schema nem de alterar as tabelas
--    de dado, mesmo usando as credenciais do `postgres`.
--
-- 3. observacoes_uf passa a guardar revisões, como observations (antes, o valor revisado
--    pelo IBGE substituía o antigo). O site lê a view observacoes_uf_atual.

-- 1 · Bloqueio de alteração -----------------------------------------------------------

create function recusa_alteracao() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'insufficient_privilege',
    message = format('%s só aceita INSERT: %s recusado', tg_table_name, tg_op),
    hint = 'Valor revisado vira linha nova com revision + 1 (docs/06, "Revisões").';
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'observations', 'observacoes_uf',
    'eleicao_apuracao', 'eleicao_votos', 'eleicao_candidatos'
  ] loop
    execute format(
      'create trigger so_insert before update or delete on %I
         for each row execute function recusa_alteracao()', t);
    execute format(
      'create trigger so_insert_truncate before truncate on %I
         for each statement execute function recusa_alteracao()', t);
  end loop;
end;
$$;

-- 3 · Revisões nos mapas por estado ------------------------------------------------------

alter table observacoes_uf add column revision int not null default 0;
alter table observacoes_uf drop constraint observacoes_uf_pkey;
alter table observacoes_uf add primary key (mapa_id, uf, ref_date, revision);

create view observacoes_uf_atual with (security_invoker = true) as
  select distinct on (mapa_id, uf, ref_date) *
  from observacoes_uf
  order by mapa_id, uf, ref_date, revision desc;

grant select on observacoes_uf_atual to anon, authenticated;

-- 2 · Papel do pipeline --------------------------------------------------------------

-- bypassrls: as tabelas têm RLS com política só de leitura; o pipeline grava.
create role coletor nologin bypassrls;
grant coletor to postgres;  -- permite `set role coletor` na conexão do pipeline

grant usage on schema public to coletor;
grant select, insert, update, delete on all tables in schema public to coletor;
grant usage, select on all sequences in schema public to coletor;
revoke update, delete, truncate on
  observations, observacoes_uf, eleicao_apuracao, eleicao_votos, eleicao_candidatos
  from coletor;

-- Tabelas futuras: o coletor recebe acesso. Tabela nova só de INSERT precisa repetir o
-- revoke acima e ganhar os triggers `so_insert` na própria migração.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to coletor;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to coletor;
