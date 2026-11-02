# 04 · Escopo do MVP

## Limites da primeira versão

- **Plataforma:** site responsivo, pensado primeiro para celular. Sem app nativo.
- **Abrangência:** dados federais e nacionais. Estados e municípios ficam para depois ([10](10-pos-mvp.md)).
- **Contas de usuário:** nenhuma. Sem login no MVP.
- **Idioma:** português do Brasil.
- **Ordem sugerida de construção:** F0 → F1 → F4 → F2 → F3 → F5 → F6. A base (F0) e o painel (F1) validam todo o pipeline de dados antes das features mais complexas.

| ID | Feature | Resumo |
|---|---|---|
| F0 | Fundação | Coletores, banco, página de indicador, metodologia e correções |
| F1 | Painel Brasil hoje | 10 a 15 indicadores com fonte, frequência e uma frase do que significa |
| F2 | Quanto eu pago | Calculadora de impostos pessoais estimados |
| F3 | Simulador da reforma tributária | O que muda de 2026 a 2033 |
| F4 | De onde vem, pra onde vai | Fluxo do dinheiro federal, da receita à despesa |
| F5 | Notícia com contexto | Notícias ligadas ao indicador oficial |
| F6 | Mesma notícia, vários veículos | Cobertura lado a lado e checagens existentes |

---

## F0 · Fundação

**Objetivo:** ter o caminho completo da fonte oficial até a tela, com rastreabilidade.

**Inclui:**
- Coletores das fontes do MVP ([05](05-fontes-de-dados.md)) e o modelo de dados de [06](06-arquitetura.md).
- Página de indicador (`/indicador/[slug]`): gráfico, valor atual, janelas padrão, alternância real/nominal, frase "o que significa", próxima divulgação, link da fonte, botão para baixar CSV.
- Página de metodologia por indicador.
- Páginas institucionais: Sobre, Metodologia geral, Correções, Quem financia, Como reportar um erro.

**Critérios de aceite:**
- [ ] Todo valor na tela tem `series_id` e pode ser rastreado até a resposta bruta da fonte.
- [ ] Revisões da fonte (ex.: IBGE revisando o PIB) geram nova versão do dado; a versão antiga não é apagada.
- [ ] Se um coletor falhar, a página mostra o último dado válido com a data dele e um aviso de atraso.
- [ ] O CSV baixado tem cabeçalho com fonte, série, unidade e data de coleta.

---

## F1 · Painel Brasil hoje

**História:** como cidadão, quero ver em uma tela os principais números da economia e das contas públicas, saber de quando é cada um e entender o que significam para mim.

**Indicadores propostos** (códigos e status em [05](05-fontes-de-dados.md)):

| Indicador | Fonte principal | Frequência |
|---|---|---|
| Inflação (IPCA) do mês e em 12 meses | IBGE (reserva: Banco Central) | Mensal |
| Taxa básica de juros (meta Selic) | Banco Central | A cada reunião do Copom |
| Dólar (PTAX) | Banco Central | Diária |
| Taxa de desocupação | IBGE, PNAD Contínua | Mensal (trimestre móvel) |
| PIB (variação no trimestre e em 4 trimestres) | IBGE, Contas Nacionais Trimestrais | Trimestral |
| Prévia da atividade (IBC-Br) | Banco Central | Mensal |
| Arrecadação federal | Receita Federal | Mensal |
| Resultado primário do governo central | Tesouro Nacional | Mensal |
| Dívida bruta do governo geral (% do PIB) | Banco Central | Mensal |
| Dívida líquida do setor público (% do PIB) | Banco Central | Mensal |
| Expectativa de inflação para o ano (Focus) | Banco Central | Semanal |
| Expectativa de Selic no fim do ano (Focus) | Banco Central | Semanal |

**A frase "o que significa para você"** é montada por template a partir dos números, nunca escrita por IA. Exemplos:

- IPCA 12 meses: "Em 12 meses, os preços subiram em média {x}%. Uma compra de R$ 100 em {mês do ano anterior} custaria R$ {100 × (1 + x/100)} hoje."
- Selic: "A taxa básica está em {x}% ao ano. Ela serve de referência para os juros de empréstimos e o rendimento de aplicações."
- Desocupação: "{x}% das pessoas que procuravam trabalho não encontraram, no trimestre encerrado em {mês}."

**Critérios de aceite:**
- [ ] Cada cartão mostra valor, variação na janela padrão, data de referência, frequência, fonte com link e próxima divulgação (quando houver calendário).
- [ ] A frase de cada cartão vem de um template versionado no repositório.
- [ ] O painel carrega em menos de 2,5 s (LCP) em celular 4G.
- [ ] Cada cartão leva à página do indicador (F0).

---

## F2 · Quanto eu pago

**História:** como trabalhador, quero estimar quanto pago de imposto por mês, separando o que sai do salário e o que está embutido no que compro.

**Entradas (MVP):** renda bruta mensal e regime de trabalho (MVP: CLT). Padrão de consumo estimado pela faixa de renda.

**Saídas:**
- Impostos diretos: contribuição ao INSS e Imposto de Renda retido, pelas tabelas oficiais vigentes no ano.
- Impostos indiretos: estimativa sobre o consumo da faixa de renda. A metodologia ainda está em aberto ([08](08-decisoes-em-aberto.md), D9).
- Total, percentual da renda e comparação com a média nacional.

**Critérios de aceite:**
- [ ] Tabelas de INSS e IR ficam em arquivos de configuração versionados por ano, com link para o ato oficial.
- [ ] O valor indireto aparece com o rótulo "estimativa" e link para a metodologia.
- [ ] Nada do que a pessoa digita sai do navegador.
- [ ] Testes unitários cobrem as faixas das tabelas e os limites entre elas.

---

## F3 · Simulador da reforma tributária

**História:** como consumidor, quero entender o que muda nos impostos sobre o consumo a cada ano da transição e como isso pode afetar o que eu compro.

**Base legal a usar:** Emenda Constitucional 132/2023, Lei Complementar 214/2025 e normas posteriores. O agente deve conferir o texto vigente antes de implementar regras.

**Linha do tempo a exibir** (detalhes em [09](09-calendario.md)):
- **2026:** fase de teste com 0,9% de CBS e 0,1% de IBS, compensados nos tributos atuais.
- **2027:** CBS plena, fim de PIS e Cofins, IPI zerado (com exceções ligadas à Zona Franca de Manaus) e início do Imposto Seletivo.
- **2029 a 2032:** ICMS e ISS diminuem 10% ao ano enquanto o IBS cresce.
- **2033:** sistema novo completo.

**Simulação:** escolher categorias de consumo e ver, por ano, quais tributos incidem. Categorias com tratamento diferenciado na lei (como a Cesta Básica Nacional e reduções de alíquota para saúde e educação) e o cashback para famílias de baixa renda devem ser conferidos na LC 214/2025 antes de entrar no simulador.

**Critérios de aceite:**
- [ ] Toda regra do simulador cita o artigo da lei de onde vem.
- [ ] Alíquotas ainda não fixadas aparecem como "a definir" ou como estimativa oficial com fonte, nunca como número inventado.
- [ ] A tela diz claramente que é uma simulação e não substitui orientação contábil.

---

## F4 · De onde vem, pra onde vai

**História:** como cidadão, quero ver de onde vem o dinheiro do governo federal e em que ele é gasto.

**Visual:** diagrama de fluxo (Sankey) da receita, por tipo, até a despesa, por função (saúde, educação, previdência, juros da dívida…).

**Dados:** Tesouro Nacional (resultado do Tesouro e execução orçamentária) e Portal da Transparência (despesa por função). Ano fechado e acumulado do ano corrente.

**Critérios de aceite:**
- [ ] Os totais do diagrama batem com os totais publicados pela fonte (teste automático).
- [ ] Juros da dívida aparecem separados da despesa primária, com explicação curta da diferença.
- [ ] Há uma tabela equivalente ao diagrama, para acessibilidade.

---

## F5 · Notícia com contexto

**História:** ao ler uma notícia sobre economia ou contas públicas, quero ver ao lado o número oficial de que ela fala.

**Funcionamento:**
1. Coletar notícias de RSS de veículos selecionados e do GDELT ([05](05-fontes-de-dados.md)).
2. Classificar o tema (inflação, juros, câmbio, emprego, PIB, impostos, gasto, dívida, reforma tributária).
3. Ligar cada tema aos indicadores correspondentes de F1.
4. Exibir título, veículo, data e link, com o cartão do indicador ao lado.

**Critérios de aceite:**
- [ ] Guardamos e exibimos só título, link, veículo, data e trecho curto. O texto da matéria nunca é republicado.
- [ ] A lista de veículos fica em configuração, com critério de inclusão publicado.
- [ ] A classificação pode usar IA, mas o cartão exibido sempre vem do banco.

---

## F6 · Mesma notícia, vários veículos

**História:** quero ver como diferentes veículos cobriram o mesmo fato e se já existe checagem sobre ele.

**Funcionamento:**
- Agrupar notícias do mesmo fato em uma janela de 48 h, por similaridade de embeddings.
- Exibir os títulos lado a lado, com um título neutro para o grupo.
- Buscar checagens relacionadas na API do Google Fact Check.

**Critérios de aceite:**
- [ ] O título neutro do grupo passa pelo verificador de termos proibidos de [02](02-principios-de-neutralidade.md#4-linguagem-sem-adjetivo).
- [ ] Não há nota ou rótulo de viés para veículos no MVP ([08](08-decisoes-em-aberto.md), D10).
- [ ] Checagens mostram a agência, a classificação dada por ela e o link.

---

## Requisitos não funcionais

- **Acessibilidade:** WCAG 2.2 nível AA. Todo gráfico tem descrição em texto e tabela.
- **Desempenho:** LCP abaixo de 2,5 s em celular. Páginas de indicador geradas estaticamente e revalidadas quando o dado muda.
- **Privacidade (LGPD):** sem login e sem cookies de rastreamento no MVP. Métricas de uso agregadas e anônimas.
- **Confiabilidade:** cada fonte tem um alerta de "dado atrasado" quando passa do prazo esperado de atualização.
