---
version: alpha
name: oBrasa
description: "Plataforma cívica de dados públicos do Brasil. Herda o Carbon da IBM (design/base/ibm.DESIGN.md): superfícies brancas, texto carvão, cantos retos, hierarquia por linhas finas e IBM Plex. Troca o IBM Blue por um azul-tinta próprio, acrescenta componentes de indicador, fonte e gráfico, e usa o ritmo editorial da WIRED (design/base/wired.DESIGN.md) só no módulo de notícias, com IBM Plex Serif no lugar das fontes proprietárias. Sem verde-amarelo, sem vermelho para dado e sem nada que se pareça com site oficial do governo."

colors:
  primary: "#23408E"
  primary-hover: "#1C3474"
  primary-pressed: "#152859"
  on-primary: "#ffffff"
  link: "#23408E"
  ink: "#161616"
  ink-muted: "#525252"
  ink-subtle: "#6f6f6f"
  canvas: "#ffffff"
  surface-1: "#f4f4f4"
  surface-2: "#e0e0e0"
  hairline: "#e0e0e0"
  hairline-strong: "#161616"
  inverse-canvas: "#161616"
  inverse-surface-1: "#262626"
  inverse-ink: "#ffffff"
  inverse-ink-muted: "#c6c6c6"
  status-delay: "#7a5a00"
  status-delay-bg: "#fcf4d6"
  form-error: "#da1e28"
  chart-1: "#23408E"
  chart-2: "#1192e8"
  chart-3: "#005d5d"
  chart-4: "#6929c4"
  chart-reference: "#8d8d8d"
  chart-band: "#f4f4f4"
  dark-canvas: "#161616"
  dark-surface-1: "#262626"
  dark-surface-2: "#393939"
  dark-ink: "#f4f4f4"
  dark-ink-muted: "#c6c6c6"
  dark-hairline: "#393939"
  dark-primary: "#9DB2F5"
  dark-on-primary: "#161616"

typography:
  display-lg:
    fontFamily: IBM Plex Sans
    fontSize: 42px
    fontWeight: 300
    lineHeight: 1.20
    letterSpacing: 0
  headline:
    fontFamily: IBM Plex Sans
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: 0
  indicator-value:
    fontFamily: IBM Plex Sans
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.5px
  indicator-label:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.375
    letterSpacing: 0.16px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  body:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0.16px
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0.16px
  eyebrow:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.29
    letterSpacing: 0.16px
  caption:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0.32px
  source-line:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  button:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.29
    letterSpacing: 0.16px
  news-headline-lg:
    fontFamily: IBM Plex Serif
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.2px
  news-headline:
    fontFamily: IBM Plex Serif
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: 0

rounded:
  none: 0px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: 12px 16px
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.inverse-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: 12px 16px
  button-tertiary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    borderColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: 12px 16px
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    height: 48px
  indicator-card:
    description: "Cartão de indicador do painel Brasil hoje. Rótulo, valor, variação, frase do que significa, chip de frequência e linha de fonte."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.indicator-value}"
    rounded: "{rounded.none}"
    padding: 24px
  indicator-card-hover:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-strong}"
    rounded: "{rounded.none}"
  source-line:
    description: "Linha obrigatória sob todo número e todo gráfico: órgão, série, período de referência e data de atualização, com link."
    textColor: "{colors.ink-muted}"
    typography: "{typography.source-line}"
  frequency-chip:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  frequency-chip-delayed:
    backgroundColor: "{colors.status-delay-bg}"
    textColor: "{colors.status-delay}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  window-tab:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 12px 16px
  window-tab-selected:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.primary}"
    typography: "{typography.indicator-label}"
    rounded: "{rounded.none}"
    padding: 12px 16px
  chart-panel:
    description: "Moldura de todo gráfico: título, subtítulo com unidade e base real/nominal, abas de janela, gráfico, linha de fonte, Ver tabela e Baixar CSV."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 24px
  mandate-band:
    description: "Faixa de fundo que marca um mandato no gráfico. Todos os mandatos da série, sem exceção, alternando com o canvas."
    backgroundColor: "{colors.chart-band}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
  estimate-callout:
    description: "Aviso de estimativa ou simulação (Quanto eu pago, Simulador da reforma)."
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 16px
  correction-banner:
    backgroundColor: "{colors.status-delay-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 16px
  news-story-row:
    description: "Linha de notícia no padrão story-row da WIRED, com o indicador relacionado ao lado."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.news-headline}"
    padding: 16px 0
  news-cluster:
    description: "Mesma notícia em vários veículos (F6): título neutro do grupo e uma news-story-row por veículo."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-strong}"
    typography: "{typography.news-headline-lg}"
    rounded: "{rounded.none}"
    padding: 24px 0
  outlet-eyebrow:
    textColor: "{colors.ink-muted}"
    typography: "{typography.eyebrow}"
  fact-check-row:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 12px 16px
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: 11px 16px
  footer:
    backgroundColor: "{colors.inverse-canvas}"
    textColor: "{colors.inverse-ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 64px 32px
---

## Overview

O oBrasa precisa parecer o que é: um lugar sóbrio para conferir números, não um app de tecnologia nem um site de campanha. Por isso a base é o **Carbon**, o design system da IBM: superfícies brancas, texto carvão, cantos retos, hierarquia por linhas finas e troca de superfície, sem sombras. É um visual de rigor que o público associa a instituição séria, e o Carbon é open source (Apache 2.0), assim como a família IBM Plex (licença OFL). Usamos o sistema, não a marca IBM.

O que é nosso: um **azul-tinta** como única cor de marca, componentes feitos para dado público (cartão de indicador, linha de fonte, chip de frequência, moldura de gráfico, faixa de mandato) e um módulo de notícias com o ritmo editorial da WIRED.

## Como este arquivo funciona

Este arquivo **adapta e aponta**. Ele não repete as bases; define só o que o oBrasa muda ou acrescenta.

**Ordem de precedência** (o primeiro que definir algo vence):

1. **Este `DESIGN.md`**: tokens e componentes do oBrasa, e as regras de [docs/02-principios-de-neutralidade.md](docs/02-principios-de-neutralidade.md).
2. **[design/base/ibm.DESIGN.md](design/base/ibm.DESIGN.md)**: tudo o que não está definido aqui (navegação, abas, campos, grid, breakpoints, alvos de toque, elevação, princípios de tipografia).
3. **[design/base/wired.DESIGN.md](design/base/wired.DESIGN.md)**: **só** os padrões de layout do módulo de notícias (story-row, divisórias finas, eyebrow de categoria, ritmo de byline). Nunca as fontes proprietárias, o preto como cor primária ou o rodapé preto.
4. **Documentação oficial do Carbon** (carbondesignsystem.com): componentes que nenhum dos arquivos cobre, como tabela de dados, dropdown, modal, notificação e seletor de conteúdo.

**Origem das bases:** repositório [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md), licença MIT, commit `fcc70284932276d085f01ef9f83edde90b1258cb` (28 out. 2026). As cópias ficam em `design/base/` para o agente ler sem depender da internet e sem mudar de versão sozinho. Para atualizar, troque os arquivos e o commit acima no mesmo PR.

| Aspecto | Origem | Ajuste do oBrasa |
|---|---|---|
| Superfícies, texto, linhas finas | IBM | Igual, exceto `ink-subtle` |
| Cor de marca | IBM (`#0f62fe`) | **Trocada** por azul-tinta `#23408E` |
| Cores de status | IBM (verde, amarelo, vermelho) | **Restritas**: vermelho só em erro de formulário; âmbar só para "dado atrasado"; verde não é usado |
| Tipografia | IBM Plex Sans | Igual, mais **Plex Mono** (fontes) e **Plex Serif** (notícias) |
| Cantos, elevação, grid, breakpoints | IBM | Igual. Pílula só nos chips |
| Display em peso 300 | IBM | Mantido nos títulos. O **valor do indicador** usa peso 600 |
| Ritmo editorial das notícias | WIRED | Com IBM Plex Serif no lugar de WiredDisplay e BreveText |
| Componentes de dado | Novos | Ver "Components" |

## Colors

### Marca
- **Azul-tinta** (`{colors.primary}`, `#23408E`): única cor de marca. Links, botão primário, aba selecionada, foco e série principal dos gráficos. Contraste de 9,6:1 sobre branco.
- Por que não o IBM Blue: com a cor exata da IBM, o site parece da IBM.
- Por que não o azul do gov.br (`#1351B4`): o oBrasa **nunca pode parecer site oficial do governo**. Pelo mesmo motivo, nada de "barra do governo" no topo nem brasão.

### Logotipo
- **Ideia:** o Cruzeiro do Sul ao lado do nome. A constelação é do céu brasileiro, não tem cor nem lado e guiou a navegação: um ponto de referência para se orientar, que é o papel do site com os dados. Escolhido em 02/11/2026 entre outros caminhos (anéis do pau-brasil, ondas do calçadão, só o nome); decisão D1 em [docs/08](docs/08-decisoes-em-aberto.md).
- **Construção** (`components/Logo.tsx`, viewBox `5 0 30 40`): as cinco estrelas nas posições reais (ascensão reta e declinação do catálogo Hipparcos), vistas do chão olhando para o sul, com Gacrux em cima e Acrux embaixo. O raio de cada ponto segue o brilho: Acrux 3,7; Mimosa 3,3; Gacrux 3,1; δ 2,4; ε 1,8. Pontos redondos, sem as pontas de estrela da bandeira, que mostra o céu visto de fora (espelhado em relação ao nosso).
- **Nome:** "oBrasa" em IBM Plex Serif 500, espaçamento -0,01em, com o "o" em azul-tinta. Símbolo com 1,3em de altura, centrado na altura do nome, a 0,32em dele.
- **Cores:** símbolo e "o" em `{colors.primary}`, "Brasa" em `{colors.ink}`. No fundo escuro (rodapé, modo escuro), `{colors.dark-primary}` e branco. Nunca verde-amarelo, vermelho, laranja ou as estrelas de pontas da bandeira ([02](docs/02-principios-de-neutralidade.md#8-cor-também-tem-lado)).
- **Ícone** (`app/icon.svg`, `app/apple-icon.png`): quadrado azul-tinta, cantos retos, só a constelação em branco a 80% do quadro; pontos com raio mínimo de 2,4 para a estrela menor não sumir a 16px. **Imagem de compartilhamento** (`app/opengraph-image.png`): logotipo grande, a frase "Dados oficiais do Brasil, com contexto e sem lado." e filete azul-tinta embaixo; nenhum número.
- **Uso:** cabeçalho (23px) e rodapé (40px). Ao abrir o site, as estrelas aparecem uma a uma, de cima para baixo (0,4s; nada com `prefers-reduced-motion`). Respiro mínimo: a altura do "o" em volta. Não mudar a posição das estrelas, não trocar por estrelas de pontas, não esticar, não separar o símbolo do nome no cabeçalho.

### Superfícies e texto
Herdados da IBM: `canvas`, `surface-1`, `surface-2`, `hairline`, `ink`, `ink-muted` e o rodapé invertido.
- **Ajuste:** `ink-subtle` passa de `#8c8c8c` (3,4:1, reprovado para texto) para `#6f6f6f` (5,0:1).

### Status
- **Dado atrasado:** `{colors.status-delay}` sobre `{colors.status-delay-bg}`, só no chip e no aviso de atraso.
- **Erro de formulário:** `{colors.form-error}`, só em campos e mensagens de erro.
- **Nunca** use verde/vermelho para dizer se um número "melhorou" ou "piorou". Inflação subir é ruim para quem compra e pode ser lido de outra forma por quem vende; a cor tomaria partido. Direção se mostra com seta fina e texto ("↑ sobe 0,4 p.p. em 12 meses"). A frase de variação ganha cor só pela direção, em tons neutros: sobe em `primary` (azul-tinta), cai em `ink-muted` (cinza-escuro), estável em `ink`. Nenhum dos dois tons quer dizer bom ou ruim (docs/08, D26).

### Gráficos
- Uma série: `{colors.chart-1}`.
- Várias séries, nesta ordem: `chart-1`, `chart-2`, `chart-3`, `chart-4` (subconjunto da paleta categórica do Carbon, sem vermelho, verde ou amarelo).
- Meta, média ou referência: `{colors.chart-reference}` tracejado.
- Faixa de mandato: `{colors.chart-band}` alternando com o canvas.
- **Nenhuma cor associada a governo, partido ou pessoa.**

### Modo escuro
Segue o tema Gray 100 do Carbon, com os tokens `dark-*`. A cor de marca no escuro é `{colors.dark-primary}` (8,7:1 sobre `dark-canvas`). A paleta de gráficos no escuro ainda precisa de validação (ver "Known Gaps").

## Typography

- **IBM Plex Sans** em toda a interface, com os princípios da base IBM: display em peso 300 e `letter-spacing: 0.16px` no corpo.
- **Exceção, `{typography.indicator-value}`**: o número do indicador usa Plex Sans 600 com algarismos tabulares (`font-variant-numeric: tabular-nums`). O número é o protagonista da tela e precisa ser lido de relance no celular.
- **IBM Plex Mono**: só em códigos de série e endpoints, na metodologia. A linha de fonte usa Plex Sans em 12px, cor `ink-muted`.
- **IBM Plex Serif** (`news-headline`, `news-headline-lg`): só nos títulos do módulo de notícias, fazendo o papel editorial que a WIRED dá a fontes proprietárias.
- **Corpo mínimo de 16px.** A frase "o que significa para você" usa `{typography.body-lg}` (18px).
- Eyebrows em caixa normal (sentence case), como manda a base IBM.
- Formato brasileiro: vírgula decimal, ponto de milhar, `R$` antes do valor, `%` colado ao número, datas como "set/2026" ou "10/10/2026".
- Fontes pelo Google Fonts ou pelos pacotes `@ibm/plex-*`, com fallback `"Helvetica Neue", Arial, sans-serif`.

## Layout

- Herdados da IBM: grade de 4px, grid de 16/8/4 colunas e breakpoints (320, 672, 1056, 1312, 1584).
- **Mobile primeiro.** O público principal lê no celular.
- **Painel Brasil hoje:** 1 cartão por linha até 672px, 2 até 1056px e 3 ou 4 acima disso.
- **Página de indicador**, nesta ordem: valor e frase → gráfico com abas de janela → linha de fonte → próxima divulgação → notícias relacionadas → metodologia.
- Seções separadas por troca de superfície (`canvas` ↔ `surface-1`), como na base IBM.

## Elevation & Depth

Herdado da IBM: sem sombras. Hierarquia por linha fina de 1px e troca de superfície. Foco com contorno de 2px em `{colors.primary}`.

## Shapes

Herdado da IBM: cantos retos (`{rounded.none}`) em botões, cartões, campos e molduras. A única forma arredondada é a pílula dos chips de frequência e status.

## Components

### `indicator-card`
O cartão do painel. De cima para baixo:
1. Rótulo (`indicator-label`) e `frequency-chip`.
2. Valor (`indicator-value`) com unidade.
3. Variação na janela padrão, com seta fina ↑ ou ↓ e texto; a frase em `primary` quando sobe e em `ink-muted` quando cai (componente `Variacao`). Sem cor de "bom" ou "ruim".
4. Frase "o que significa" (`body-lg`), vinda de template.
5. `source-line`.
6. Próxima divulgação, em `caption`.

O cartão inteiro é um link para a página do indicador. No hover, troca para `surface-1` com borda `hairline-strong`.

### `source-line`
Obrigatória sob todo número e todo gráfico. Formato curto, sem separadores:
`Fonte: IBGE (set/2026)`
O nome do órgão é link para a série na fonte; entre parênteses, a data de referência. Só a página do indicador acrescenta a data da última atualização: `Fonte: IBGE (set/2026), atualizado em 10/10/2026`. Código da série e endpoint ficam na metodologia; a frequência, no `frequency-chip`.

### `frequency-chip`
"Diário", "Mensal", "Trimestral", "A cada reunião do Copom". Quando o dado passa do prazo esperado, vira `frequency-chip-delayed` com o texto "Atrasado desde dd/mm".

### `window-tab`
Abas fixas: **12 meses · 5 anos · 10 anos · Tudo**. Seleção com sublinhado de 2px em `{colors.primary}`, como as abas da base IBM. Nenhuma tela cria janela própria.

### `chart-panel`
Moldura de todo gráfico:
- título;
- subtítulo com unidade e base ("R$ bilhões, a preços de set/2026");
- seletor Real/Nominal (seletor de conteúdo do Carbon) quando a série for monetária;
- abas de janela;
- gráfico;
- `source-line`;
- ações "Ver tabela" e "Baixar CSV".

Regras do gráfico:
- Barras sempre começam do zero.
- Linhas podem não começar do zero, mas o eixo fica sempre visível e rotulado.
- Sem eixo duplo, sem 3D e sem pizza com mais de 3 fatias.
- Mudança de metodologia da fonte aparece como linha vertical com rótulo.

### `mandate-band`
Faixa de fundo por mandato, com rótulo do período ("2023–2026"). Se uma faixa aparece, todas aparecem. O rótulo pode trazer o nome de quem governou, desde que em todos os mandatos da série.

### `estimate-callout`
Usado em Quanto eu pago e no Simulador da reforma: "Estimativa. Veja a metodologia." Fundo `surface-1` com borda esquerda de 3px em `primary`.

### `correction-banner`
Aparece no topo de qualquer página cujo dado foi corrigido nos últimos 30 dias, com link para o registro de correções.

### `theme-nav`
Navegação por temas no topo: Brasil hoje, Economia, Trabalho, Contas públicas (e os próximos temas, na ordem de `config/temas.yaml`). O item ativo tem texto `ink` 600 e sublinhado de 3px em `primary`, que desliza entre itens. No celular, os temas ficam numa segunda linha com rolagem horizontal; o menu "Ferramentas" (calculadora, comparador de datas, agenda) e Metodologia ficam à direita da marca. Ao trocar de tema, o cabeçalho fica parado e só o conteúdo desliza 32px para o lado do tema escolhido (tema à direita na lista entra pela direita), com fade, em 0,22s; sem deslocamento com `prefers-reduced-motion`.

### `brasil-hoje-board`
A home é um quadro de instrumentos: uma linha por tema, abaixo de um filete de 2px em `ink`. Colunas no desktop: tema (nome, resumo, link para o tema) · indicador principal (rótulo, chip, valor de 56px, variação) · sparkline. A `source-line` curta fica embaixo do valor. Não é uma grade de cartões.

### `release-agenda`
Linha do tempo das próximas divulgações, com as datas dos calendários coletados. Linha vertical de 2px em `ink`, um marcador quadrado por dia, dia em 32px light. Mostra só datas que existem no banco.

### `indicator-tile`
Versão compacta do `indicator-card` para a grade de cada tema: rótulo e chip, valor de 36px com sparkline ao lado, base do valor real quando monetário, variação e `source-line` curta. Grade de 1/2/3 colunas separada por filetes, sem frase. O tile inteiro é link (stretched link), e a linha de fonte continua clicável.

### `sparkline`
Linha de 1,5px em `chart-1` com ponto no último valor, sem eixo. Período que a fonte não publicou interrompe a linha (vale também para o gráfico do `chart-panel`); série anual não tem a aba "12 meses". Sempre acompanhada do valor e da `source-line`; é decorativa para leitor de tela (`aria-hidden`). Série diária usa o último valor de cada mês. Nos tiles, passar o mouse ou o dedo mostra o ponto mais próximo: fio vertical, ponto vazado e etiqueta escura com período e valor ("set/2025: 5,17%"). Parada, a minilinha não mostra nada além da linha.

### Bloco próprio de cada tema
Cada página de tema abre com uma visualização diferente, para a navegação não ficar repetitiva. Todas têm título, subtítulo com unidade e período, descrição em texto para leitor de tela e uma `source-line` por série usada.
- **Economia, `dual-line`**: meta Selic e IPCA 12 meses no mesmo eixo, 10 anos, rótulo direto no fim de cada linha (`chart-1` e `chart-2`), sem legenda separada.
- **Trabalho, `waffle`**: 100 quadrados, "de cada 100 pessoas na força de trabalho". O valor decimal preenche parte do último quadrado (nada é arredondado). Ao lado, o mesmo período um ano antes, em cinza. Abaixo, `proportion-bar` da informalidade (parte em `chart-1`, resto em cinza).
- **Educação, `education-steps`**: uma barra de 100% por ano, pessoas de 25 anos ou mais por nível de instrução concluído, do menor (tom claro de `chart-1`) ao maior (`chart-1` puro). Percentuais escritos só na linha mais recente. Ano sem pesquisa vira linha tracejada com "sem dado publicado", e a nota abaixo diz o motivo. Nunca interpolar.
- **Contas públicas, `pib-ruler`**: régua de 0 a 100% do PIB (estende se algum valor passar). Para cada dívida, faixa cinza do menor ao maior valor da série, com as datas escritas, e marcador em `primary` no valor atual.

### Página Eleições 2026
Página própria (não usa a grade de tiles). Um só tom (`chart-1` e misturas dele com o fundo) para todos os candidatos e partidos; nenhuma cor de partido (docs/08, D14).
- **`split-bar`**: 2º turno para presidente. Barra única em `chart-1`, os dois candidatos separados por um traço da cor do fundo, traço tracejado em 50% dos válidos. Nome, partido, percentual de 64px, votos e a situação com as palavras do TSE em caixa de frase. Na home, versão de 16px no lugar da sparkline.
- **`candidate-bars`**: 1º turno, uma linha por candidato na ordem dos votos, barras na escala de 0 a 100% dos válidos (a mesma para todos).
- **`choropleth-map`**: mapa por município, projeção cônica de áreas iguais. O leitor escolhe turno e candidato; a cor é a fatia dos válidos dele em 5 faixas fixas de 20 pontos, iguais para todos os candidatos. Divisas de UF em linha da cor do fundo. Trocar de turno ou candidato muda as cores numa varredura de oeste para leste. Dica no hover com município, percentual e votos. Alternativa em texto: tabelas por UF em `<details>`.
- **`turnout-bar`**: barra de 100% dos eleitores aptos por turno: válidos, brancos, nulos, abstenção e seções não instaladas, com legenda em lista de definições.
- **`seat-grid`**: um quadrado por cadeira, agrupados por partido do maior para o menor (sem eixo esquerda–direita); grupos vizinhos alternam dois tons. Hover ou foco num partido apaga os demais.
- Tabela de governadores e senadores eleitos por UF, com o turno em que o governador foi decidido.
- `source-line` do TSE: "Fonte: TSE (25/10/2026)"; arquivo e datas de geração e conferência no `title` do link e em docs/05.

### `mapa-uf`
Mapa do Brasil por estado, no fim do bloco próprio de Trabalho e de Educação. Um tom só (`chart-1` misturado ao fundo em 5 faixas iguais entre o menor e o maior valor do período mostrado; a legenda muda com o período). **Divisas entre estados em traço de 2,6px na cor do fundo** e contorno do país em `ink-muted`, para cada UF se separar bem da vizinha. Estado em foco ganha contorno de 2,6px em `ink`. Ao lado (embaixo no celular), os 27 estados em ordem, com barra, valor e posição; a lista reordena com mola quando o período muda e destaca o estado em foco no mapa. Seletor de período por controle deslizante; seletor de indicador em botões segmentados quando o tema tem mais de um mapa. Nomes das UFs como o IBGE publica. `source-line` com o link da tabela no SIDRA e link para o número do Brasil.

### Ferramentas
Três páginas no menu "Ferramentas" do cabeçalho e no rodapé. Campos no padrão Carbon (fundo `surface-1`, filete inferior), sem caixas.
- **Calculadora da inflação (`/calculadora`)**: linhas "R$ [valor] em [mês] [ano]", até seis, todas corrigidas para o mesmo mês de destino. Cada linha mostra o valor corrigido em 28px, uma barra em `primary` proporcional ao maior resultado e o IPCA acumulado no período. Com duas linhas ou mais, uma frase compara as duas primeiras. A conta e a fonte ficam escritas embaixo. O estado vai para o endereço (`?v=2000_2015-01,2000_2020-01&base=2026-09`) para a conta poder ser compartilhada.
- **Comparar datas (`/comparar`)**: Data A e Data B (mês e ano), atalhos "1 ano antes", "5 anos antes", "10 anos antes". Tabela por tema: indicador com `source-line`, valor em cada data com o período de referência embaixo (e o nominal, se monetário), diferença com seta fina ↑↓ e a mesma cor por direção da frase de variação, em p.p. (taxas) ou % (níveis). Sem atalhos por governo. No celular, cada linha vira um bloco de três colunas com rótulos.
- **Agenda (`/agenda`)**: calendário de um mês por vez, com setas; a troca de mês desliza 32px. Cada dia mostra um marcador por evento com filete colorido: `primary` para IBGE, `ink` para Banco Central. No celular, só as barras coloridas; o texto fica na lista. Clicar num dia filtra a lista; a lista do mês fica sempre embaixo, com data, órgão em etiqueta, o que sai (link para cada indicador), período de referência e link para o calendário do órgão. Datas passadas em `ink-muted`.

### Imagem de compartilhamento
Cada indicador tem imagem própria de 1200×630 (`/indicador/{slug}/opengraph-image`): faixa de 12px em `primary` no topo, logotipo, tema, título, valor em 100px, período (e a base do valor real), variação com seta fina desenhada e a cor por direção, minilinha de 10 anos e, embaixo de um filete, "Fonte: órgão (período)". Mesmos números da página, do banco.

### Movimento
Biblioteca `motion`, com `MotionConfig reducedMotion="user"`: quem pede menos movimento vê tudo parado no estado final. Momentos com movimento: o sublinhado da navegação desliza e o conteúdo do tema desliza para o lado do tema escolhido; sparklines e linhas do bloco do tema se desenham uma vez ao entrar na tela; o waffle, a régua e a escada de instrução se preenchem uma vez; as barras do resultado eleitoral crescem uma vez; no mapa da eleição, ao trocar de turno ou candidato, as cores mudam numa varredura de oeste para leste (0,35s por município, até 0,45s de atraso); no mapa por estado, as cores mudam em 0,45s e a lista reordena com mola; a barra da calculadora cresce até o novo valor. Nada se move em loop. No hover, só a leitura da minilinha e o destaque do estado no mapa, que respondem ao gesto da pessoa.

### Módulo de notícias (padrão WIRED)
- **`news-story-row`**: linha com divisória fina, como a story-row da WIRED. Contém o `outlet-eyebrow` (nome do veículo), o título em Plex Serif, a hora e um mini `indicator-card` ao lado (empilhado embaixo no celular). O link vai para o site do veículo.
- A página `/noticias` é folheada: um tema por página, como um jornal. Abas com o nome e a contagem de cada tema, setas ‹ › com o nome da página vizinha e "2 de 6" no meio, teclas ← →, arrastar para o lado no celular e, no fim de cada página, "Próxima página" com o nome do tema seguinte. A página desliza 48px com fade em 0,22s (sem deslocamento com `prefers-reduced-motion`). A rolagem vertical nunca é capturada. Cada página tem endereço próprio (`#economia`) e o voltar do navegador volta a página. A primeira página, "Agora", traz a matéria com foto mais recente (foto 16:9, manchete de 36px, trecho) ao lado de três outras com foto pequena, uma por veículo, e a lista das seguintes. Nas páginas de tema: título do tema em `news-headline-lg` com o mini `indicator-card` do indicador principal e a linha de fonte à direita, uma grade de até três matérias com foto 3:2 e, abaixo, as demais só com título, em duas colunas. Tema com uma só foto põe a foto à esquerda e a lista à direita. Só a data, sem hora, no fuso de Brasília ("01/11"); data absoluta porque a página fica em cache. No fim de cada página de tema, um bloco "Notícias sobre …" com até quatro matérias com foto e quatro só com título. No máximo duas matérias por veículo em cada lista. Critério de inclusão e lista de veículos sempre visíveis no fim da página.
- **`news-cluster`**: título neutro do grupo em `news-headline-lg`, seguido de uma `news-story-row` por veículo e, se houver, das `fact-check-row`.
- **`fact-check-row`**: nome da agência e a classificação **com as palavras da própria agência**, sem cor por classificação.
- Fotos só as que o próprio feed do veículo indica para a matéria, carregadas do endereço do veículo (sem `next/image`, que copiaria a imagem para o nosso servidor) e sempre dentro de um link para a matéria no site do veículo. Se o veículo recusar a imagem, o cartão fica só com o texto. Matéria sem foto entra na lista de títulos, nunca com imagem genérica no lugar.

### Componentes herdados sem mudança
Botões, campos de texto, abas, navegação e rodapé seguem a base IBM. O rodapé invertido do oBrasa traz sempre os links Metodologia, Correções, Quem financia e Reportar erro.

## Do's and Don'ts

### Do
- Mostrar `source-line` em todo número e todo gráfico.
- Usar `{colors.primary}` com parcimônia: link, ação principal, foco, aba selecionada e série principal.
- Usar seta e texto para direção, nunca só cor.
- Manter cantos retos e hierarquia por linha fina.
- Escrever números no formato brasileiro, com algarismos tabulares.

### Don't
- Não usar o IBM Blue (`#0f62fe`), o logotipo ou qualquer elemento da marca IBM.
- Não usar o azul do gov.br, brasão ou qualquer coisa que faça o site parecer oficial.
- Não usar verde e amarelo juntos, nem vermelho ou verde como cor de dado.
- Não usar contador animado ou número "girando".
- Não usar as fontes proprietárias da WIRED (WiredDisplay, BreveText, Apercu).
- Não pôr sombra em cartão, nem gradiente de fundo.
- Não usar adjetivo em título de gráfico ([docs/02](docs/02-principios-de-neutralidade.md#4-linguagem-sem-adjetivo)).

## Responsive Behavior

Herdado da IBM, com estes ajustes:
- Alvos de toque de 48px em todo o site.
- `indicator-value` cai de 48px para 40px abaixo de 672px.
- `display-lg` cai de 42px para 32px abaixo de 672px.
- Abas de janela rolam na horizontal dentro do próprio container no celular. A página nunca rola de lado.
- Gráficos ficam com altura mínima de 220px no celular, com "Ver tabela" logo abaixo.

## Implementação

- **Componentes:** `@carbon/react` com um tema próprio que sobrescreve os tokens de cor do Carbon pelos tokens deste arquivo (`interactive`, `link-primary`, `focus`, `button-primary` e os equivalentes `-hover` e `-active`).
- **Gráficos:** `@carbon/charts-react`, com a paleta `chart-*` deste arquivo. ECharts é a alternativa se faltar algum tipo de gráfico (por exemplo, Sankey para F4).
- **Tokens no código:** gerar variáveis CSS a partir do front matter deste arquivo, com prefixo `--bd-`.
- Conferir versões e licenças dos pacotes ao instalar.

## Iteration Guide

1. Antes de criar um componente, procure nesta ordem: este arquivo → base IBM → documentação do Carbon. Só crie um novo se nenhum servir.
2. Componente novo entra no front matter, com nome em inglês e descrição em português.
3. Toda tela nova passa pelo checklist de PR de [docs/02](docs/02-principios-de-neutralidade.md#checklist-de-pull-request).
4. Rode `npx @google/design.md lint DESIGN.md` depois de editar este arquivo.
5. Se alguém pedir cantos arredondados, sombra ou uma segunda cor de marca, a resposta padrão é não. Mudanças assim são decisão de produto e vão para [docs/08](docs/08-decisoes-em-aberto.md).

## Known Gaps

- **Logo e nome:** dependem da decisão D1 ([docs/08](docs/08-decisoes-em-aberto.md)). Até lá, use o nome em texto, Plex Sans 600.
- **Paleta de gráficos no modo escuro:** falta validar contraste de `chart-2` a `chart-4` sobre `dark-canvas`.
- **Card para compartilhar (WhatsApp e redes):** formato 1080×1350 a desenhar, com `source-line` e QR code embutidos.
- **Ilustrações:** estilo não definido. Até lá, nenhuma ilustração.
- **Sankey de F4:** o Carbon não tem esse gráfico; definir o estilo ao implementar.
