-- Conferência automática dos marcos da aba Impostos (docs/02, seção 9; docs/06).
--
-- 1. marcos_verificacoes: uma linha por conferência feita (só INSERT). Guarda o hash do
--    marco e do texto da lei; se nada mudou, o job reaproveita a última conferência e não
--    chama o modelo de novo.
-- 2. marcos_tributarios ganha os dispositivos citados (URN do normas.leg.br) e o hash da
--    conferência que liberou o marco. `conferido_por`/`conferido_em` passam a ser
--    preenchidos pelo job com a conferência automática aprovada.

create table marcos_verificacoes (
  id bigint generated always as identity primary key,
  marco_id text not null,
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  aprovado boolean not null,
  -- false: o modelo não deu resposta válida (erro da API, limite de turnos, verificação).
  -- Inconclusiva não é reaproveitada: o job tenta de novo na próxima execução.
  conclusiva boolean not null,
  motivos text[] not null default '{}',
  afirmacoes jsonb not null default '[]',   -- [{afirmacao, trecho}] citados da lei
  normas jsonb not null,                    -- {URN da norma: raw_object}
  modelo text,                               -- null quando reprovou na checagem de números
  versao_prompt text not null,
  custo_usd numeric not null default 0 check (custo_usd >= 0),
  verificado_em timestamptz not null default now()
);

create index marcos_verificacoes_hash on marcos_verificacoes (marco_id, hash, verificado_em desc)
  where conclusiva;

alter table marcos_verificacoes enable row level security;
create policy "leitura pública" on marcos_verificacoes for select using (true);
grant select on marcos_verificacoes to anon, authenticated;

revoke update, delete, truncate on marcos_verificacoes from coletor;
create trigger so_insert before update or delete on marcos_verificacoes
  for each row execute function recusa_alteracao();
create trigger so_insert_truncate before truncate on marcos_verificacoes
  for each statement execute function recusa_alteracao();

alter table marcos_tributarios add column dispositivos text[] not null default '{}';
alter table marcos_tributarios add column verificacao_hash text;
alter table marcos_tributarios add constraint marcos_conferencia_com_hash
  check ((conferido_em is null) = (verificacao_hash is null));
alter table marcos_verificacoes add constraint aprovada_e_conclusiva check (conclusiva or not aprovado);
