-- Prazo de divulgação por série, para fontes sem calendário (config/sources.yaml, `prazo`).
-- O padrão por frequência (mensal: 2 meses + 14 dias) serve ao IBGE, mas não ao IBC-Br nem
-- às estatísticas fiscais do BC, que saem mais tarde: com ele, o site mostrava "Atrasado"
-- em dado que estava em dia. Usado por delayStatus (apps/web/src/lib/indicator.ts) e pelo
-- job `atrasos` (pipelines/jobs/atrasos.py).

alter table series
  add column prazo_meses int check (prazo_meses >= 0),
  add column prazo_dias int check (prazo_dias >= 1),
  add constraint series_prazo_completo check ((prazo_meses is null) = (prazo_dias is null));
