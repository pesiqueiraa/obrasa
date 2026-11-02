-- Uma mesma tabela e variável do IBGE pode virar várias séries, uma por categoria
-- (ex.: tabela 7141, variável 10282: 15 a 17 anos no ensino médio e 18 a 24 anos no
-- superior). A chave única passa a incluir a classificação.

alter table series drop constraint series_source_id_codigo_externo_key;

create unique index series_fonte_codigo_classificacao_key
  on series (source_id, codigo_externo, coalesce(classificacao, ''));
