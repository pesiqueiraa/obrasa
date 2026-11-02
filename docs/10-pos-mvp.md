# 10 · Próximos passos pós-MVP

Roadmap das features depois da primeira versão, organizado por fases. Cada fase só começa quando a anterior estiver estável e com as métricas de [01](01-visao-do-produto.md#como-saber-se-está-funcionando-mvp) acompanhadas. Quando uma feature for priorizada, ela ganha história e critérios de aceite no formato de [04](04-mvp.md).

**Esforço:** P (até 1 semana), M (2 a 4 semanas), G (mais de 1 mês), para uma pessoa com ajuda de agente de IA.

## Visão geral

| Fase | Foco | Features |
|---|---|---|
| 2 | Aprofundar e trazer o leitor de volta | Para onde vamos, Agenda, Alertas, Meu estado, Cards para compartilhar |
| 3 | Alcançar quem está no WhatsApp | Verificador de número, Bot de WhatsApp, Pergunte aos dados, Radar do Congresso, Monitor de metas oficiais, Emendas, Transferências |
| 4 | Virar infraestrutura para outros | API pública e downloads, Widgets, Detector de recorte, Painel de revisões, Comparação internacional, Acessibilidade ampliada, Material para professores, Status das fontes |
| 5 | Eleições municipais de 2028 | Painel por município, Dados de candidaturas, Guia de pesquisas |
| Contínua | Melhorar os sistemas | Qualidade de dados, revisão editorial assistida, observabilidade, governança |

---

## Fase 2 · Aprofundar e trazer o leitor de volta

### 2.1 Para onde vamos
- **O quê:** expectativas lado a lado para inflação, juros, PIB e dívida. Fontes: Focus (Banco Central), Prisma Fiscal (Ministério da Fazenda) e projeções da IFI (Senado).
- **Por quê:** responde à terceira pergunta de toda tela ("o que vem por aí?") sem a plataforma fazer previsão própria.
- **Cuidado:** deixar claro quem projeta o quê. Expectativa de mercado não é previsão oficial.
- **Esforço:** M

### 2.2 Agenda do que vem aí
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
- **O quê:** imagem pronta para WhatsApp e redes, gerada a partir de cada indicador, com fonte, data e QR code embutidos na própria imagem.
- **Por quê:** quando o card é encaminhado, a origem vai junto. É o antídoto direto ao número solto.
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
