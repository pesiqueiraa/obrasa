-- Papel `leitor`: só SELECT, para os agentes de IA (pipelines/agentes, docs/06).
--
-- Os agentes investigam e explicam, nunca gravam. Esta é a primeira de cinco camadas
-- (as outras ficam em pipelines/agentes/ferramentas.py): cada consulta roda numa
-- transação somente leitura, com `set local role leitor`, um único comando (protocolo
-- estendido), começo SELECT/WITH e rollback no fim.
--
-- Em produção o agente usa credencial própria: `alter role leitor login password ...`,
-- feito à mão no painel (a senha não entra no git), e a URL vai no segredo
-- AGENTES_DATABASE_URL. Assim nem `reset role` devolve um papel com escrita.

create role leitor nologin bypassrls;  -- bypassrls: lê tudo, mas só lê
grant leitor to postgres;  -- permite `set role leitor` no desenvolvimento local

grant usage on schema public to leitor;
grant select on all tables in schema public to leitor;

alter default privileges for role postgres in schema public
  grant select on tables to leitor;
