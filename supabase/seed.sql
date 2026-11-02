-- Só no banco local (`supabase db reset`); o seed não roda em produção.
--
-- Login do papel `leitor` para os agentes de IA no desenvolvimento:
-- AGENTES_DATABASE_URL=postgresql://leitor:leitor@127.0.0.1:55322/postgres
-- Em produção a senha é definida à mão no painel e nunca entra no git
-- (migração 20261111000000_leitor.sql).
alter role leitor login password 'leitor';
