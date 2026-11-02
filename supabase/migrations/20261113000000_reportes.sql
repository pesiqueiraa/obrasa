-- Reportes de erro enviados pelo formulário do site (/reportar-erro).
--
-- O site só consegue chamar `registra_reporte` (anon): não lê, não altera e não apaga
-- reporte nenhum. O texto não é público. Quem trata o reporte lê e muda o status no
-- painel do Supabase; o job `atrasos` abre uma issue "Reportes de erro" enquanto houver
-- reporte com status `novo` (scripts/reportes.py), só com a contagem, sem o texto.
--
-- Não guardamos e-mail, IP nem nada que identifique quem reportou (página /privacidade).
-- Contra spam: campo isca e tempo mínimo de preenchimento no site, e no banco um limite
-- de 30 reportes por hora no total.

create table reportes (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  pagina text check (char_length(pagina) <= 300),
  descricao text not null check (char_length(descricao) between 10 and 2000),
  fonte text check (fonte is null or (char_length(fonte) <= 500 and fonte ~ '^https?://')),
  status text not null default 'novo'
    check (status in ('novo', 'em_analise', 'corrigido', 'sem_erro', 'descartado')),
  nota text  -- anotação de quem tratou; a correção pública vai para `corrections`
);

create index reportes_status on reportes (status, criado_em);

alter table reportes enable row level security;  -- sem política: ninguém lê pela API
revoke all on reportes from anon, authenticated;
revoke all on reportes from coletor;
grant select on reportes to coletor, leitor;  -- contagem para a issue; agentes

create function registra_reporte(p_pagina text, p_descricao text, p_fonte text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo bigint;
begin
  if (select count(*) from public.reportes where criado_em > now() - interval '1 hour') >= 30 then
    raise exception using
      errcode = 'P0001',
      message = 'limite de reportes por hora atingido; tente de novo mais tarde';
  end if;
  insert into public.reportes (pagina, descricao, fonte)
  values (nullif(btrim(p_pagina), ''), btrim(p_descricao), nullif(btrim(p_fonte), ''))
  returning id into novo;
  return novo;
end;
$$;

revoke all on function registra_reporte(text, text, text) from public, anon, authenticated;
grant execute on function registra_reporte(text, text, text) to anon;
