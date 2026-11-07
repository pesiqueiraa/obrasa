-- Liberação automática de saltos (pipelines/saltos.py; docs/06).
--
-- Cada vez que a coleta segura um salto fora do histórico, grava (série, período, valor).
-- Se a fonte publicar o mesmo valor por PERSISTENCIA_HORAS, ou a segunda fonte confirmar,
-- a coleta seguinte libera e grava outra linha com `liberado` e o motivo. Só INSERT: o
-- histórico de liberações fica auditável, como em config/aprovacoes.yaml.

create table saltos_vistos (
  id bigint generated always as identity primary key,
  serie text not null,
  periodo date not null,
  valor numeric not null,
  liberado boolean not null,
  motivo text,
  visto_em timestamptz not null default now(),
  check (liberado = (motivo is not null))
);

create index saltos_vistos_busca on saltos_vistos (serie, periodo, valor, visto_em) where not liberado;

alter table saltos_vistos enable row level security;
create policy "leitura pública" on saltos_vistos for select using (true);
grant select on saltos_vistos to anon, authenticated;

revoke update, delete, truncate on saltos_vistos from coletor;
create trigger so_insert before update or delete on saltos_vistos
  for each row execute function recusa_alteracao();
create trigger so_insert_truncate before truncate on saltos_vistos
  for each statement execute function recusa_alteracao();
