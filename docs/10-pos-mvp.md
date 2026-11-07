# 10 · Próximos passos pós-MVP

Roadmap das features depois da primeira versão, organizado por fases. Cada fase só começa quando a anterior estiver estável e com as métricas de [01](01-visao-do-produto.md#como-saber-se-está-funcionando-mvp) acompanhadas. Quando uma feature for priorizada, ela ganha história e critérios de aceite no formato de [04](04-mvp.md).

**Esforço:** P (até 1 semana), M (2 a 4 semanas), G (mais de 1 mês), para uma pessoa com ajuda de agente de IA.

## Visão geral

| Fase | Foco | Features |
|---|---|---|
| 2 | Aprofundar e trazer o leitor de volta | Para onde vamos, Agenda, Alertas, Meu estado, Cards para compartilhar, Busca, Aba Impostos, Página por divulgação |
| 3 | Alcançar quem está no WhatsApp | Verificador de número, Bot de WhatsApp, Pergunte aos dados, Radar do Congresso, Monitor de metas oficiais, Emendas, Transferências, Acompanhar os eleitos |
| 4 | Virar infraestrutura para outros | API pública e downloads, Widgets, Detector de recorte, Painel de revisões, Comparação internacional, Acessibilidade ampliada, Material para professores, Status das fontes |
| 5 | Eleições municipais de 2028 | Painel por município, Dados de candidaturas, Guia de pesquisas |
| Contínua | Melhorar os sistemas | Qualidade de dados, revisão editorial assistida, observabilidade, governança |

---

## Fase 2 · Aprofundar e trazer o leitor de volta

## Prioridade combinada em 07/11/2026

Ordem de trabalho decidida na conversa de 07/11/2026. Métricas de uso (D11) ficam para depois, porque dependem de serviço pago ou de conta externa; a prioridade agora é o que é gratuito.

| Ordem | O quê | Seção |
|---|---|---|
| 1 | Contas públicas completa (resultado primário, juros, arrecadação) e expectativas do Focus | 2.1, 2.7 |
| 2 | Aba Impostos, primeira versão | 2.7 |
| 3 | Revisão da interface com capturas em celular e desktop | Contínua |
| 4 | Página por divulgação, QR no card, busca rápida | 2.8, 2.5, 2.6 |
| 5 | Acompanhar os eleitos: presidente e 27 governadores | 3.8 |
| 6 | Meu estado (Siconfi) e simuladores F2 e F3 | 2.4, [04](04-mvp.md) |
| 7 | Parlamentares (votos, cota, emendas) e alertas por e-mail | 3.4, 3.6, 2.3 |

### 2.1 Para onde vamos
- **Feito em parte (07/11/2026):** mediana do Focus nas páginas dos indicadores que o Focus cobre ([05](05-fontes-de-dados.md#banco-central--focus-expectativas-de-mercado)). Faltam Prisma Fiscal e IFI.
- **O quê:** expectativas lado a lado para inflação, juros, PIB e dívida. Fontes: Focus (Banco Central), Prisma Fiscal (Ministério da Fazenda) e projeções da IFI (Senado).
- **Por quê:** responde à terceira pergunta de toda tela ("o que vem por aí?") sem a plataforma fazer previsão própria.
- **Cuidado:** deixar claro quem projeta o quê. Expectativa de mercado não é previsão oficial.
- **Esforço:** M

### 2.2 Agenda do que vem aí
- **Feito em parte (02/11/2026):** `/agenda` com divulgações do IBGE e reuniões do Copom (docs/08, D23). Faltam prazos do orçamento, reforma tributária e votações.
- **O quê:** calendário com reuniões do Copom, divulgações do IBGE, prazos do orçamento, marcos da reforma tributária e votações importantes ([09](09-calendario.md)).
- **Por quê:** dá motivo para voltar e alimenta os alertas.
- **Esforço:** P

### 2.3 Alertas e newsletter
- **O quê:** aviso por e-mail (e depois por WhatsApp) quando sai o IPCA, a decisão do Copom ou a arrecadação do mês. Resumo semanal.
- **Cuidado:** primeira feature com dado pessoal (e-mail). Exige política de privacidade, opção de saída em um clique e consentimento claro (LGPD).
- **Esforço:** M

### 2.4 Meu estado, minha cidade
- **O quê:** receita, despesa, dívida e limites da Lei de Responsabilidade Fiscal por UF e, depois, por município, via Siconfi.
- **Por quê:** o dado local é o que mais afeta a vida das pessoas e o menos explicado.
- **Esforço:** G

### 2.5 Cards para compartilhar
- **Feito em parte (02/11/2026):** imagem de compartilhamento de cada indicador (docs/08, D25). Falta o QR code.
- **O quê:** imagem pronta para WhatsApp e redes, gerada a partir de cada indicador, com fonte, data e QR code embutidos na própria imagem.
- **Por quê:** quando o card é encaminhado, a origem vai junto. É o antídoto direto ao número solto.
- **Esforço:** P

---

### 2.6 Busca rápida
- **O quê:** caixa de busca no cabeçalho (atalho `/` no teclado) que encontra indicadores, temas, ferramentas e estados pelo nome ou por sinônimos comuns ("desemprego" → Desocupação, "juros" → Selic). Resultado com o valor atual e a linha de fonte.
- **Por quê:** com mais temas, ferramentas e mapas, chegar ao número pelo nome fica mais rápido que pela navegação.
- **Cuidado:** a lista de sinônimos é pública e versionada, como os termos das notícias; sem busca por IA.
- **Esforço:** P

### 2.7 Aba Impostos
- **O quê:** um tema próprio, `/impostos`, para pessoa física e para empresa, com quatro partes:
  1. **Linha do tempo de 2026 a 2033:** o que muda e quando na reforma tributária (EC 132/2023, LC 214/2025) e no imposto de renda, cada marco com lei, artigo e link para o Planalto.
  2. **Arrecadação federal mês a mês, por tributo**, em valores reais e nominais (Receita Federal).
  3. **Projetos em tramitação** sobre impostos (Câmara), separados e com o selo "Proposta, não é lei".
  4. **Notícias** do tema impostos.
- **Por quê:** a reforma muda os impostos sobre consumo todo ano até 2033, e janeiro de 2027 tem a CBS plena e o fim do PIS e da Cofins ([09](09-calendario.md)). "Imposto" é o número solto que mais circula.
- **Cuidado:** regras de [02](02-principios-de-neutralidade.md#9-lei-é-fonte-projeto-é-proposta). Os marcos são escritos à mão em `config/impostos.yaml` e conferidos por uma pessoa antes de publicar. Um erro de data ou alíquota pesa mais que a falta do marco.
- **Depois:** os simuladores F2 ("Quanto eu pago") e F3 ([04](04-mvp.md)) entram nesta aba.
- **Esforço:** M

### 2.8 Página por divulgação
- **O quê:** uma página permanente por divulgação de cada indicador (ex.: `/indicador/ipca-12-meses/2026-10`), com o número, a variação e as notícias daquele mês.
- **Por quê:** é o que a pessoa procura no buscador ("IPCA outubro 2026"), e o arquivo vira referência para citar.
- **Esforço:** P

---

## Fase 3 · Alcançar quem está no WhatsApp

### 3.1 Verificador de número
- **O quê:** a pessoa cola um texto ou envia um print com um número ("a inflação está em 15%"). A plataforma identifica de qual indicador se trata, mostra o valor oficial, a data e o contexto.
- **Como:** a IA só extrai a afirmação e o indicador citado. O valor de comparação vem sempre do banco. Se não houver série correspondente, a resposta é "não temos dado oficial para isso".
- **Por quê:** é o uso mais direto da missão da plataforma.
- **Esforço:** G

### 3.2 Bot de WhatsApp
- **O quê:** o verificador e os cards dentro do WhatsApp, pela API oficial do WhatsApp Business.
- **Cuidado:** a API cobra por conversa e exige templates aprovados. Calcular custo antes. Nunca enviar mensagem sem a pessoa ter pedido.
- **Esforço:** G

### 3.3 Pergunte aos dados
- **O quê:** assistente que responde perguntas ("quanto o governo gastou com saúde em 2025?") usando só o banco, sempre citando a série e o período.
- **Regras:** as mesmas de [06](06-arquitetura.md#regras-de-uso-de-ia). Sem série, sem resposta. Toda resposta mostra o gráfico de origem.
- **Esforço:** G

### 3.4 Radar do Congresso
- **O quê:** projetos que mexem com impostos, taxas e gasto, com tramitação, votos e orientação de bancada (APIs da Câmara e do Senado).
- **Cuidado:** mostrar votos como registro, sem nota ou ranking de parlamentares. Explicar que uma "votação" pode ser parecer, emenda ou destaque.
- **Esforço:** M

### 3.5 Monitor de metas oficiais
- **O quê:** compara o realizado com as metas que o próprio Estado definiu: meta de inflação, meta de resultado primário do arcabouço fiscal, limites da Lei de Responsabilidade Fiscal.
- **Por quê:** é a forma mais neutra de avaliar desempenho, porque a régua é a do próprio governo, seja ele qual for.
- **Esforço:** M

### 3.6 Emendas parlamentares
- **O quê:** quanto foi indicado e pago em emendas, por tipo, autor, UF e município (Portal da Transparência).
- **Cuidado:** tema sensível. Mostrar só o registro oficial, com a mesma visualização para todos os autores.
- **Esforço:** M

### 3.7 Transferências para estados e municípios
- **O quê:** quanto cada UF e município recebe da União (FPE, FPM e outras), com a API de transferências do Tesouro.
- **Esforço:** M

### 3.8 Acompanhar os eleitos
- **O quê:** uma página por governante eleito em 2026 (presidente e 27 governadores) com o que foi registrado no plano de governo ao lado do dado oficial. Quatro camadas:
  1. **Plano de governo registrado no TSE:** trechos citados literalmente, com página e link para o PDF ([05](05-fontes-de-dados.md#tse--dados-abertos-eleições-2026)).
  2. **Metas do próprio governo:** PPA 2028–2031, meta de resultado primário, meta de inflação. A régua é a que o governo definiu.
  3. **Indicadores ligados:** para cada promessa com número, a série oficial correspondente, com o último valor antes da posse (jan/2027) e o valor atual.
  4. **Registro do mandato** (parlamentares, depois): votos, presença, projetos, cota parlamentar e emendas, pelas APIs da Câmara, do Senado e do Portal da Transparência (3.4, 3.6).
- **Regra central:** o oBrasa não avalia se a promessa foi cumprida ([02](02-principios-de-neutralidade.md#10-promessas-e-mandatos)). Sem selo, nota, ranking ou percentual de cumprimento.
- **Como:** a ligação entre promessa e indicador fica em `config/promessas.yaml`, escrita e revisada por pessoas, pública e contestável pelo formulário de erro. Nenhuma IA escolhe trecho nem ligação.
- **Por quê:** a pessoa quer saber se o eleito está fazendo o que disse. A forma neutra de responder é pôr o que foi dito ao lado do que o dado mostra, com a mesma régua para todos.
- **Cuidado:** revisão jurídica antes de lançar (lei eleitoral e risco de difamação). Começar depois da posse, em janeiro de 2027, quando o ponto de partida fica fixo.
- **Esforço:** G

---

## Fase 4 · Virar infraestrutura para outros

### 4.1 API pública e downloads
- **O quê:** os dados tratados da plataforma, com a mesma rastreabilidade, disponíveis em API e CSV.
- **Por quê:** jornalistas, pesquisadores e outros projetos passam a usar e citar a plataforma.
- **Esforço:** M

### 4.2 Widgets embutíveis
- **O quê:** gráficos para colocar em sites, blogs e matérias, sempre com fonte e link de volta.
- **Esforço:** M

### 4.3 Detector de recorte
- **O quê:** a pessoa escolhe a janela de tempo de um gráfico que recebeu e a plataforma mostra o mesmo dado em todas as janelas padrão, lado a lado.
- **Por quê:** ensina na prática como o recorte muda a história, sem acusar ninguém.
- **Esforço:** P

### 4.4 Painel de revisões
- **O quê:** histórico de quando as fontes oficiais revisaram números (como o PIB), com o antes e o depois.
- **Por quê:** transparência sobre por que um número "mudou".
- **Esforço:** P (os dados já ficam guardados desde F0)

### 4.5 Comparação internacional
- **O quê:** o Brasil ao lado de outros países no mesmo indicador, com fontes como Banco Mundial, FMI e OCDE.
- **Cuidado:** a escolha dos países de comparação precisa de critério fixo e público (por exemplo, países de renda média e da América Latina).
- **Esforço:** M

### 4.6 Acessibilidade ampliada
- **O quê:** modo leitura fácil, áudio dos resumos e integração com o VLibras.
- **Esforço:** M

### 4.7 Material para professores
- **O quê:** atividades prontas usando os gráficos da plataforma, para ensino médio.
- **Esforço:** M

### 4.8 Status das fontes
- **O quê:** página pública mostrando se cada fonte está atualizada, atrasada ou fora do ar.
- **Esforço:** P

---

## Fase 5 · Eleições municipais de 2028

### 5.1 O que o próximo prefeito herda
- **O quê:** painel por município com contas, dívida, transferências recebidas e indicadores sociais, com a mesma régua para todas as cidades.
- **Esforço:** G

### 5.2 Dados de candidaturas
- **O quê:** bens declarados e contas de campanha, a partir dos dados abertos do TSE, com o mesmo formato para todos os candidatos.
- **Cuidado:** sem ranking e sem juízo. Revisão jurídica antes de lançar.
- **Esforço:** M

### 5.3 Guia de pesquisas
- **O quê:** explicar como ler uma pesquisa eleitoral (margem de erro, registro no TSE, metodologia).
- **Cuidado:** só exibir pesquisa com número de registro visível ([07](07-riscos-e-cuidados.md), R3).
- **Esforço:** P

---

## Contínua · Melhorar os sistemas

| Melhoria | O que faz | Esforço |
|---|---|---|
| Dupla fonte com alerta de divergência | Compara a mesma série em duas fontes (ex.: IPCA no IBGE e no Banco Central) e alerta se divergirem | P |
| Detecção de anomalia nos coletores | Avisa quando um valor foge do padrão histórico antes de ir para a tela | M |
| Verificador de linguagem no CI | Bloqueia PR com termo proibido em textos da interface | P |
| Verificador de "todo número tem série" | Teste automático que procura número na tela sem `series_id` | M |
| Observabilidade | Painel interno com atraso por fonte, erros de coleta e custo de IA | M |
| Conselho editorial plural | Pessoas de diferentes campos políticos revisam regras e textos, com nomes publicados | Contínuo |
| Ouvidoria e reporte de erro | Formulário público com prazo de resposta publicado | P |
| Testes de usabilidade, nunca de enquadramento | Testar se a pessoa entende a tela; nunca testar qual manchete engaja mais | Contínuo |

## Como priorizar

1. Votos do quadro de brainstorm.
2. Impacto na missão: ajuda a pessoa a checar um número sozinha?
3. Esforço (P, M, G).
4. Risco para a credibilidade ([07](07-riscos-e-cuidados.md)).

Feature de alto impacto, baixo esforço e baixo risco vai primeiro. Feature de risco alto só entra depois que os mecanismos de correção e revisão estiverem funcionando.
