-- Imagem de destaque das notícias. Guarda só o endereço que o próprio feed do veículo
-- associa à matéria; a imagem é exibida a partir do site do veículo e nunca copiada.
alter table news_articles
  add column imagem text check (imagem is null or (imagem like 'https://%' and char_length(imagem) <= 1000));
