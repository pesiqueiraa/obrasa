-- Agendador das notícias no banco (docs/06, "Agendamento"; docs/11).
--
-- O cron do GitHub Actions descarta a maior parte das execuções: de 48 horários por dia
-- no noticias.yml, rodaram de 3 a 5 entre 03/11 e 06/11/2026, com intervalos de 4 a 8 h.
-- Vários feeds só cobrem de 0,5 a 2 h de matérias (UOL, InfoMoney, Metrópoles, Poder360,
-- g1), então cada execução perdida perde notícias. Aqui o pg_cron do Supabase chama a
-- API do GitHub a cada 30 minutos para disparar o workflow (workflow_dispatch com
-- origem=agendador). O cron do próprio workflow continua como reserva; o `concurrency`
-- do workflow impede duas coletas ao mesmo tempo.
--
-- O token fica no Vault, nunca no git. Em produção, uma vez, no SQL Editor:
--   select vault.create_secret('<token>', 'github_dispatch_token');
-- Token fine-grained só deste repositório, permissão "Actions: read and write".
-- Sem o segredo (desenvolvimento local), a função não chama nada.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Esquema fora da API (config.toml expõe só public e graphql_public).
create schema if not exists agendador;
revoke all on schema agendador from public;

create function agendador.dispara(workflow text) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  select decrypted_secret into token
    from vault.decrypted_secrets
   where name = 'github_dispatch_token';
  if token is null then
    raise notice 'agendador: sem github_dispatch_token no Vault; % não disparado', workflow;
    return null;
  end if;
  -- Resposta (204 quando aceita) fica em net._http_response por algumas horas.
  return net.http_post(
    url := 'https://api.github.com/repos/pesiqueiraa/obrasa/actions/workflows/' || workflow || '/dispatches',
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('origem', 'agendador')),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || btrim(token, E' \t\r\n'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'obrasa-agendador',
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function agendador.dispara(text) from public, anon, authenticated;

-- Minutos fora de :00 e :30, como no workflow.
select cron.schedule('noticias', '17,47 * * * *', $$select agendador.dispara('noticias.yml')$$);
