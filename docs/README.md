# oBrasa: documentação do produto

> O nome **oBrasa** foi escolhido em 02/11/2026 (antes, nome de trabalho oBrasa). Veja [01-visao-do-produto.md](01-visao-do-produto.md#nome).

Esta pasta descreve o que estamos construindo, por quê e com quais regras. Ela foi escrita para duas audiências: as pessoas do projeto e os agentes de IA que vão escrever o código. Antes de começar qualquer tarefa, o agente deve ler este arquivo e os arquivos indicados para a tarefa.

## Ordem de leitura

| # | Arquivo | Para que serve | Ler antes de… |
|---|---|---|---|
| 01 | [Visão do produto](01-visao-do-produto.md) | Problema, público, o que a plataforma é e não é, opções de nome | Qualquer tarefa |
| 02 | [Princípios de neutralidade](02-principios-de-neutralidade.md) | Regras editoriais que viram critério de aceite de código e conteúdo | Qualquer tarefa que exiba dado ou texto |
| 03 | [Panorama do que já existe](03-panorama-existente.md) | Referências, concorrentes e a lacuna que vamos ocupar | Decisões de produto |
| 04 | [Escopo do MVP](04-mvp.md) | Features da primeira versão, com critérios de aceite | Implementar features |
| 05 | [Fontes de dados](05-fontes-de-dados.md) | APIs oficiais, endpoints, códigos de séries e armadilhas | Escrever coletores |
| 06 | [Arquitetura e stack](06-arquitetura.md) | Componentes, modelo de dados, agendamento, regras de uso de IA | Estruturar o repositório |
| 07 | [Riscos e cuidados](07-riscos-e-cuidados.md) | O que pode derrubar a credibilidade e como evitar | Revisões |
| 08 | [Decisões em aberto](08-decisoes-em-aberto.md) | O que ainda não foi decidido, com recomendação provisória | Tarefas que dependem dessas decisões |
| 09 | [Calendário e ganchos](09-calendario.md) | Datas e divulgações recorrentes que pautam o produto | Planejar conteúdo e jobs |
| 10 | [Próximos passos pós-MVP](10-pos-mvp.md) | Roadmap de features depois da primeira versão | Planejar fases seguintes |
| — | [DESIGN.md](../DESIGN.md) (raiz do repositório) | Design system: adapta o Carbon da IBM e aponta para as bases em `design/base/` | Qualquer tarefa de interface |

## Estrutura no repositório

```text
/
├── DESIGN.md        # design system do oBrasa (adapta e aponta para as bases)
├── design/base/     # bases fixas: IBM (Carbon) e WIRED, com licença MIT
└── docs/            # esta pasta
```

## Regras que o agente nunca pode quebrar

1. **Todo número exibido vem do banco de dados**, e todo dado do banco vem de uma fonte registrada em [05](05-fontes-de-dados.md). Nenhum número é gerado, estimado ou completado por um modelo de linguagem.
2. **Todo número mostra a fonte com link e a data de referência**, no formato curto "Fonte: IBGE (set/2026)". A frequência de divulgação aparece no chip do indicador; a data da última atualização, na página do indicador; o código da série, na metodologia.
3. **Série monetária tem versão nominal e real** (corrigida pelo IPCA), com o mês-base escrito na tela.
4. **Textos seguem o guia de linguagem** de [02](02-principios-de-neutralidade.md#4-linguagem-sem-adjetivo): sem adjetivos valorativos, sempre com unidade e período.
5. **Nenhuma pesquisa eleitoral** é exibida sem o número de registro no TSE.
6. **Códigos e endpoints marcados como `confirmar`** em [05](05-fontes-de-dados.md) precisam ser testados contra a fonte antes do uso. Depois de testar, atualize o status no próprio arquivo.
7. **Notícias de terceiros**: guardar e exibir só título, link, veículo, data, um trecho curto e, se o feed do veículo oferecer, a imagem de destaque, carregada do endereço do veículo e nunca copiada para o nosso servidor. Nunca republicar o texto da matéria.
8. **Interface segue o [DESIGN.md](../DESIGN.md)**, que tem precedência sobre as bases em `design/base/`. Os arquivos de `design/base/` nunca são editados.

## Como manter esta pasta

- Uma decisão tomada sai de "aberta" e vai para "decidida" em [08](08-decisoes-em-aberto.md), com data e motivo.
- Toda fonte nova entra em [05](05-fontes-de-dados.md) antes de entrar no código.
- Feature nova do roadmap entra em [10](10-pos-mvp.md); quando for priorizada, ganha critérios de aceite no formato de [04](04-mvp.md).
- Sugestão: copie a seção "Regras que o agente nunca pode quebrar" para um `AGENTS.md` ou `CLAUDE.md` na raiz do repositório, para que o agente leia as regras em toda sessão.

---
Levantamento inicial: 1º de novembro de 2026.
