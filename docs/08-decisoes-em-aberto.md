# 08 · Decisões em aberto

Formato: cada decisão tem opções, uma recomendação provisória e o que depende dela. Quando for tomada, mova para a seção "Decididas", com data e motivo.

## Abertas

| ID | Pergunta | Opções | Recomendação provisória | Bloqueia |
|---|---|---|---|---|
| D2 | Formato jurídico | Projeto pessoal, associação sem fins lucrativos, empresa | Começar como projeto pessoal open source; formalizar antes de receber dinheiro | D3 |
| D3 | Financiamento | Doações de pessoas, editais e fundações, patrocínio institucional, serviços para empresas | Doações e editais, com tudo publicado na página "Quem financia" | Lançamento público |
| D4 | Abrangência inicial | Só federal; federal + estados; tudo | Só federal no MVP | F4, fase 2 |
| D5 | Primeiro canal | Web, app, bot de WhatsApp | Web responsiva primeiro; WhatsApp na fase 3 | Arquitetura de front |
| D6 | Revisão editorial | Uma segunda pessoa; conselho plural; checklist automático | Checklist automático no MVP; conselho plural depois do lançamento | Publicação de textos |
| D7 | Data de lançamento | Antes de janeiro de 2027; depois | Lançar uma versão mínima (F0 + F1) antes de janeiro de 2027, aproveitando a posse dos novos mandatos e a CBS plena | Planejamento |
| D8 | Licenças | Código: MIT ou AGPL. Conteúdo próprio: CC BY 4.0 | Código MIT; conteúdo CC BY 4.0; dados seguem a licença de cada fonte | Repositório público |
| D9 | Metodologia dos impostos indiretos em F2 | Carga média sobre consumo (relatório "Carga Tributária no Brasil", da Receita) aplicada ao consumo por faixa de renda (POF/IBGE); alíquotas legais por categoria; tabela do IBPT | Carga média oficial + POF, rotulada como estimativa | F2 |
| D10 | Classificar viés de veículos em F6 | Não classificar; usar classificação externa; criar a própria | Não classificar no MVP | F6 |
| D11 | Métricas de uso | Ferramenta sem cookies (Plausible, Umami); Google Analytics | Ferramenta sem cookies | Lançamento |
| D12 | Modelo de IA e de embeddings | Escolher por custo, qualidade em português e dimensão do vetor | Testar 2 opções com 200 notícias rotuladas à mão | F5, F6 |

## Decididas

| ID | Decisão | Data | Motivo |
|---|---|---|---|
| D13 | Plataforma organizada por temas (Brasil hoje, Economia, Trabalho, Contas públicas; depois Eleições 2026, Educação e Notícias), cada tema com página própria e uma visualização diferente no topo | 01/11/2026 | Pedido do responsável pelo projeto: abas por assunto e menos repetição entre seções |
| D14 | Mapa eleitoral em um só tom, com escolha do candidato; sem pintar o município pela cor do vencedor | 01/11/2026 | Mapa de vencedor exagera áreas grandes e pouco povoadas e associa cor a lado (docs/02) |
| D15 | Resultados de Eleições 2026 vêm do TSE (dados abertos), com malhas municipais do IBGE | 01/11/2026 | Fonte oficial; endpoints testados em 01/11/2026 (docs/05) |
| D17 | Eleições: candidatos em ordem de votos, bancadas em ordem de tamanho (sem eixo ideológico), situação com as palavras do TSE, e cada arquivo do TSE só vira coleta nova se os números mudarem | 02/11/2026 | Evitar ordem ou classificação que sugira lado (docs/02); o TSE regenera os arquivos com frequência sem mudar os números |
| D18 | Linha de fonte curta, "Fonte: órgão (referência)", em Plex Sans; atualização na página do indicador, código da série na metodologia, frequência no chip. Regra 2 reescrita | 02/11/2026 | Pedido do responsável pelo projeto: a linha longa, com separadores, pesava a leitura |
| D1 | Nome: **oBrasa** (antes, nome de trabalho Brasilado). A cor da marca continua o azul-tinta; o nome não leva a interface para vermelho ou laranja. Logotipo: Cruzeiro do Sul em pontos, nas posições reais, ao lado do nome em Plex Serif (DESIGN.md, "Logotipo") | 02/11/2026 | Escolha do responsável pelo projeto. Ainda falta buscar a marca no INPI e registrar o domínio |
| D21 | Notícias com foto: a regra 7 passa a permitir a imagem de destaque que o feed do veículo indica, exibida do endereço do veículo e nunca copiada | 02/11/2026 | Pedido do responsável pelo projeto. O feed é o canal que o veículo oferece para divulgar a matéria; a imagem leva ao site dele e nós não guardamos o arquivo |
| D20 | Notícias: tema de cada matéria por lista pública de termos em `config/noticias.yaml` (título e trecho, sem acento, palavra inteira), sem IA. Colunas, opinião e notícias de outros países ficam de fora. Agrupamento da mesma notícia em vários veículos (F6) e checagens ficam para depois | 02/11/2026 | Regra auditável e reproduzível; o banco é reclassificado a cada coleta, então o que aparece segue sempre a regra publicada. No máximo duas matérias por veículo em cada lista, para um feed com 100 itens não cobrir os outros |
| D19 | Educação usa a PNAD Contínua anual (IBGE). Períodos que a fonte não publicou ficam como lacuna declarada na configuração e aparecem vazios nos gráficos | 02/11/2026 | Mesma fonte e coletor de Trabalho; ligar 2019 a 2022 com uma reta sugeriria dados de 2020 e 2021 que não existem |
| D22 | Ferramentas: calculadora da inflação (`/calculadora`), comparador de datas (`/comparar`) e agenda (`/agenda`), no menu "Ferramentas" do cabeçalho. A calculadora usa o número-índice do IPCA (IBGE 1737/2266) desde jul/1994 e aceita até seis valores e datas; o comparador usa, em cada data, o último dado publicado até o fim do mês e mostra o período de cada número. Atalhos só por distância de tempo ("1 ano antes"), nunca por governo | 02/11/2026 | Pedido do responsável pelo projeto ("comparar em quais datas ele quiser"). Atalho por mandato sugeriria atribuir o número a um governo (docs/02) |
| D23 | Agenda: datas do IBGE pela API oficial do calendário; datas do Copom digitadas em `config/copom.yaml` a partir da página do BC, com as reuniões passadas conferidas automaticamente nos comunicados do BC | 02/11/2026 | O BC não tem API do calendário do Copom (docs/05). A conferência impede que uma data digitada errada fique no ar depois da reunião |
| D24 | Mapas por estado em Trabalho (desocupação) e Educação (analfabetismo e anos de estudo), do IBGE nível UF. Um tom só, 5 faixas iguais entre o menor e o maior valor do período mostrado, divisas grossas e lista dos 27 estados em ordem ao lado | 02/11/2026 | Pedido do responsável pelo projeto: separar bem os estados. Faixas do período (e não da série inteira) para os estados se distinguirem; a legenda muda com o período |
| D25 | Imagem de compartilhamento por indicador (valor, período, variação, minilinha e fonte curta), gerada dos mesmos dados da página | 02/11/2026 | Quando o link é encaminhado, a fonte e a data vão junto (docs/10, 2.5) |
| D27 | Aba Governos: uma página por mandato presidencial desde 1995, no mesmo formato para todos (indicadores na posse e no fim, metas do próprio governo e resultado, trechos do plano registrado no TSE com número ou prazo, e as normas do período). Trechos localizados por IA e conferidos literalmente no PDF por código, sem pessoa escolhendo; regra de [02](02-principios-de-neutralidade.md#10-promessas-e-mandatos) reescrita | 08/11/2026 | Pedido do responsável pelo projeto: começar pelos governos que já terminaram, e operação sem conferência humana. Desde 1995 porque antes do Plano Real a inflação tira o sentido da comparação; planos no TSE só existem a partir da eleição de 2010 (testado em 08/11/2026) |
| D26 | Frases de variação com seta fina (↑ ↓) e cor por direção em tons neutros: sobe em azul-tinta, cai em cinza-escuro. Verde e vermelho continuam fora | 02/11/2026 | Pedido do responsável pelo projeto (cor para aumento e diminuição). Verde/vermelho foi considerado e descartado: pintaria inflação ou desemprego subindo como "bom" (docs/02); o responsável escolheu a cor neutra |
| D16 | Ordem das próximas etapas: design por temas → Economia, Trabalho e Contas públicas → Eleições 2026 → Educação → Notícias por tema | 01/11/2026 | Aprovado pelo responsável pelo projeto |
