# 07 · Riscos e cuidados

| # | Risco | Por que importa | Como evitar |
|---|---|---|---|
| R1 | "Tempo real" que não é | Contadores que giram por segundo são estimativas. Se a plataforma fizer isso sem avisar, perde a credibilidade que é seu diferencial | Mostrar a frequência real de cada dado. Proibir interpolação sem rótulo ([02](02-principios-de-neutralidade.md#5-frequência-e-data-à-vista)) |
| R2 | Erro de cálculo com séries de taxa | Somar 12 meses de IPCA mensal dá um número errado e fácil de ser apontado | Encadear variações; testar contra o acumulado publicado pelo IBGE ([06](06-arquitetura.md#testes)) |
| R3 | Pesquisa eleitoral sem registro | Divulgar pesquisa eleitoral sem registro no TSE gera multa | Não exibir pesquisas no MVP. No futuro, só com número de registro visível |
| R4 | IA inventando número ou fonte | Um único número inventado compromete a plataforma inteira | Regras e verificações de [06](06-arquitetura.md#regras-de-uso-de-ia). Sem série, sem resposta |
| R5 | API oficial fora do ar ou mudando sem aviso | Planilhas e APIs públicas mudam de layout e saem do ar | Guardar respostas brutas, validar cabeçalhos, alertar atrasos, mostrar o último dado válido com a data |
| R6 | Acusação de viés pelos dois lados | Vai acontecer, especialmente em período eleitoral | Responder com a metodologia publicada e o registro de correções, nunca com opinião. Publicar as regras editoriais antes do lançamento |
| R7 | Direito autoral das notícias | Republicar matéria de terceiros é violação | Guardar e exibir só título, link, veículo, data e trecho curto |
| R8 | Escolha de veículos parecer enviesada | A lista de fontes de notícia vira alvo de crítica | Critério de inclusão público e lista ampla. Sem nota de viés no MVP ([08](08-decisoes-em-aberto.md), D10) |
| R9 | Simulador tributário tomado como consultoria | Pessoas podem tomar decisões com base numa estimativa | Rótulos de "estimativa" e "simulação"; regras citando o artigo da lei; aviso de que não substitui orientação contábil |
| R10 | Financiamento comprometer a independência | Dinheiro com agenda tira a neutralidade, ou parece tirar | Página "Quem financia"; recusar dinheiro de partidos, candidatos e campanhas ([02](02-principios-de-neutralidade.md#7-dinheiro-às-claras)) |
| R11 | Dados pessoais | Calculadoras recebem renda; LGPD se aplica | Cálculo no navegador, sem envio ao servidor; sem login no MVP |
| R12 | Chave do Portal da Transparência suspensa | Passar de 400 requisições/min suspende a chave por 8 h | Limitador de taxa no coletor e coletas grandes de madrugada |
| R13 | Custo de IA crescer | Embeddings e resumos em volume custam | Cache, processamento em lote e limite diário por job |
| R14 | Revisões oficiais mudarem números já publicados | O IBGE revisa o PIB, por exemplo; parece que "mudamos o número" | Guardar revisões; mostrar "revisado em" na página do indicador |
