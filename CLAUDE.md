# CLAUDE.md

Instruções para agentes de IA que trabalham neste repositório. Antes de qualquer tarefa, leia [docs/README.md](docs/README.md) e os arquivos que ele indica para a tarefa.

## Regras que o agente nunca pode quebrar

Copiadas de [docs/README.md](docs/README.md#regras-que-o-agente-nunca-pode-quebrar). Se as duas versões divergirem, vale a de `docs/README.md`.

1. **Todo número exibido vem do banco de dados**, e todo dado do banco vem de uma fonte registrada em [05](docs/05-fontes-de-dados.md). Nenhum número é gerado, estimado ou completado por um modelo de linguagem.
2. **Todo número mostra a fonte com link e a data de referência**, no formato curto "Fonte: IBGE (set/2026)". A frequência de divulgação aparece no chip do indicador; a data da última atualização, na página do indicador; o código da série, na metodologia.
3. **Série monetária tem versão nominal e real** (corrigida pelo IPCA), com o mês-base escrito na tela.
4. **Textos seguem o guia de linguagem** de [02](docs/02-principios-de-neutralidade.md#4-linguagem-sem-adjetivo): sem adjetivos valorativos, sempre com unidade e período.
5. **Nenhuma pesquisa eleitoral** é exibida sem o número de registro no TSE.
6. **Códigos e endpoints marcados como `confirmar`** em [05](docs/05-fontes-de-dados.md) precisam ser testados contra a fonte antes do uso. Depois de testar, atualize o status no próprio arquivo.
7. **Notícias de terceiros**: guardar e exibir só título, link, veículo, data, um trecho curto e, se o feed do veículo oferecer, a imagem de destaque, carregada do endereço do veículo e nunca copiada para o nosso servidor. Nunca republicar o texto da matéria.
8. **Interface segue o [DESIGN.md](DESIGN.md)**, que tem precedência sobre as bases em `design/base/`. Os arquivos de `design/base/` nunca são editados.

## Como rodar

Veja [README.md](README.md#desenvolvimento).
