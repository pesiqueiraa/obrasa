-- Registro de execuções dos jobs (docs/06, "Vigia").
--
-- Cada `python -m pipelines.run <job>` grava uma linha ao terminar, com sucesso ou não.
-- O site lê só job, horário e resultado (/saude), para um monitor de fora do GitHub
-- perceber quando a esteira para de rodar. O texto dos erros não é público: fica para
-- o coletor e para o papel `leitor` dos agentes.

create table execucoes (
  id bigint generated always as identity primary key,
  job text not null,
  iniciado_em timestamptz not null,
  -- Início e fim vêm do relógio do job (pipelines/db.py), não do banco: os relógios da
  -- máquina do job e do banco podem divergir em frações de segundo.
  terminado_em timestamptz not null default clock_timestamp(),
  ok boolean not null,
  novos int not null default 0,
  revisados int not null default 0,
  erros jsonb not null default '[]'::jsonb,
  avisos jsonb not null default '[]'::jsonb,
  check (terminado_em >= iniciado_em)
);

create index execucoes_job_terminado on execucoes (job, terminado_em desc);

-- Só INSERT, como as tabelas de dado (20261109000000_integridade.sql).
create trigger so_insert before update or delete on execucoes
  for each row execute function recusa_alteracao();
create trigger so_insert_truncate before truncate on execucoes
  for each statement execute function recusa_alteracao();
revoke update, delete, truncate on execucoes from coletor;

alter table execucoes enable row level security;
create policy "leitura pública" on execucoes for select using (true);
-- Leitura pública só das colunas sem texto de erro. O Supabase dá acesso total a anon e
-- authenticated em toda tabela nova (default privileges); aqui isso é retirado antes.
revoke all on execucoes from anon, authenticated;
grant select (job, iniciado_em, terminado_em, ok) on execucoes to anon, authenticated;
grant select on execucoes to leitor;
