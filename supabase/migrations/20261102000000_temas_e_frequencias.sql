-- Organização por temas (docs/08, D13) e séries de outras frequências (Fase 2 de docs/04).
--
--   * series.frequencia ganha 'trimestral_movel' (PNAD Contínua: o período é o mês final
--     do trimestre móvel, ex.: 2026-09-01 = jul–set/2026).
--   * Séries diárias guardam o dia de verdade. As demais continuam no 1º dia do período;
--     a regra sai do check da tabela e vai para um gatilho que olha a frequência da série.
--   * series.classificacao: filtro de classificação do IBGE (ex.: '11255[90707]', PIB a
--     preços de mercado), guardado junto com a série para rastrear a origem.
--   * indicators.tema, casas_decimais e serie_nominal (versão nominal de série monetária,
--     regra 3 do AGENTS.md).

alter table series drop constraint series_frequencia_check;
alter table series add constraint series_frequencia_check
  check (frequencia in ('diaria', 'mensal', 'trimestral_movel', 'trimestral', 'anual', 'evento'));
alter table series add column classificacao text;

alter table observations drop constraint observations_ref_date_check;

create function observations_ref_date_valida() returns trigger
language plpgsql
set search_path = public
as $$
declare
  freq text;
begin
  select frequencia into freq from series where id = new.series_id;
  if freq is distinct from 'diaria' and extract(day from new.ref_date) <> 1 then
    raise exception 'série % (%) exige ref_date no 1º dia do período, veio %',
      new.series_id, freq, new.ref_date;
  end if;
  return new;
end;
$$;

create trigger observations_ref_date_valida
  before insert or update on observations
  for each row execute function observations_ref_date_valida();

alter table indicators add column tema text;
alter table indicators add column casas_decimais int not null default 2
  check (casas_decimais between 0 and 4);
alter table indicators add column serie_nominal text references series(id);
