# 05 · Fontes de dados

Regras gerais:
- Só fontes oficiais e primárias ([02](02-principios-de-neutralidade.md#1-só-fonte-oficial-primária)).
- **Status `ok`** significa que o endpoint ou código foi visto em documentação ou em uso real durante o levantamento. **Status `confirmar`** significa que precisa ser testado antes de ir para o código. Depois de testar, atualize a tabela.
- Toda resposta bruta é guardada antes de qualquer transformação ([06](06-arquitetura.md)).

## Resumo

| Fonte | Uso no MVP | Acesso | Autenticação | Frequência |
|---|---|---|---|---|
| Banco Central · SGS | Selic, câmbio, dívida, IBC-Br, IPCA (reserva) | API REST JSON | Nenhuma | Diária a mensal |
| Banco Central · Focus | Expectativas de mercado | API OData (Olinda) | Nenhuma | Semanal |
| Banco Central · PTAX | Dólar oficial do dia | API OData (Olinda) | Nenhuma | Diária |
| IBGE · Agregados v3 (SIDRA) | IPCA, desocupação, PIB, população | API REST JSON | Nenhuma | Mensal e trimestral |
| IBGE · Malhas e Localidades | Mapas e códigos de UF e município | API REST | Nenhuma | Raramente muda |
| Tesouro · Siconfi | Contas de estados e municípios (pós-MVP) | API REST (ORDS) | Nenhuma | Bimestral e quadrimestral |
| Tesouro Transparente | Resultado do Tesouro, dívida | CKAN (planilhas e CSV) | Nenhuma | Mensal |
| Receita Federal | Arrecadação federal | Relatórios e dados abertos | Nenhuma | Mensal |
| Portal da Transparência (CGU) | Despesa por função, emendas | API REST | Chave gratuita | Diária |
| Câmara dos Deputados | Proposições e votações (pós-MVP) | API REST | Nenhuma | Contínua |
| Senado Federal | Matérias e votações (pós-MVP) | API REST | Nenhuma | Contínua |
| Base dos Dados | Atalho para históricos | BigQuery | Conta Google | Varia |
| GDELT DOC 2.0 | Descoberta de notícias | API REST | Nenhuma | Contínua |
| RSS dos veículos | Notícias | RSS/Atom | Nenhuma | Contínua |
| Google Fact Check Tools | Checagens publicadas | API REST | Chave de API | Contínua |

---

## Banco Central · SGS (séries temporais)

```http
GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json&dataInicial=01/01/2020&dataFinal=31/12/2025
GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados/ultimos/{N}?formato=json
```

Resposta: `[{"data":"01/07/2026","valor":"0.07"}]`

**Armadilhas:**
- Datas no formato `dd/MM/aaaa` e valor como texto com ponto decimal. Converter na entrada.
- Séries diárias exigem intervalo de datas e têm limite de período por requisição. Fatie a busca em janelas de no máximo 10 anos (`confirmar` o limite atual para séries diárias). Séries mensais (433, 13522) aceitam o histórico inteiro numa só requisição, com ou sem `dataInicial`/`dataFinal` (testado em 01/11/2026).
- O modo `ultimos/N` aceita no máximo **20** registros; acima disso responde HTTP 400 ("A quantidade máxima de valores deve ser 20"). Testado em 01/11/2026. Para históricos, use intervalo de datas.
- **Séries que já são variação (IPCA mensal, IGP-M) não se somam.** O acumulado é encadeado: `acum = Π(1 + x/100) − 1`.

| Código | Série | Unidade | Frequência | Status |
|---|---|---|---|---|
| 432 | Meta Selic definida pelo Copom | % a.a. | Diária | ok (testado em 01/11/2026: um valor por dia corrido desde 05/03/1999; **traz datas futuras** até a véspera da próxima reunião, que o coletor descarta) |
| 11 | Selic diária | % a.d. | Diária | ok |
| 1178 | Selic anualizada base 252 | % a.a. | Diária | ok |
| 433 | IPCA, variação mensal (reserva do IBGE) | % | Mensal | ok (testado em 01/11/2026: desde jan/1980) |
| 13522 | IPCA acumulado em 12 meses | % | Mensal | ok (testado em 01/11/2026: desde dez/1980, idêntico a IBGE 1737/2265 em todos os meses) |
| 1 | Dólar comercial, venda (taxa livre) | R$/US$ | Diária | ok (testado em 01/11/2026: dias úteis; usado desde 01/07/1994, início do real) |
| 10813 | Dólar comercial, compra (taxa livre) | R$/US$ | Diária | ok |
| 13762 | Dívida bruta do governo geral (% do PIB), metodologia a partir de 2008 | % | Mensal | ok (testado em 01/11/2026: desde dez/2006) |
| 4537 | Dívida bruta do governo geral (% do PIB), metodologia até 2007 | % | Mensal | ok |
| 4513 | Dívida líquida do setor público consolidado (% do PIB) | % | Mensal | ok (testado em 01/11/2026: desde dez/2001) |
| 24363 | IBC-Br, sem ajuste sazonal | Índice | Mensal | ok (testado em 01/11/2026: desde jan/2003) |
| 5793, 4649, 5364 | Resultado primário (candidatas) | — | Mensal | confirmar: respondem, mas o nome oficial não pôde ser conferido (catálogo do SGS e portal de dados abertos do BC com HTTP 502 em 01/11/2026). Não usar até conferir. |

Catálogo completo: https://www3.bcb.gov.br/sgspub/ (`confirmar`: respondeu HTTP 502 em 01/11/2026).

Página de metodologia do IPCA no IBGE, citada em `config/indicators.yaml`: `confirmar` (HTTP 403 a clientes automáticos em 01/11/2026; conferir num navegador antes de exibir no site).

## Banco Central · Focus (expectativas de mercado)

```http
GET https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'IPCA' and DataReferencia eq '2027'&$orderby=Data desc&$top=10&$format=json
```

Codifique os espaços e aspas da URL. Documentação: https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/documentacao

**Conjuntos disponíveis (ok):** `ExpectativasMercadoAnuais`, `ExpectativasMercadoTop5Anuais`, `ExpectativaMercadoMensais`, `ExpectativasMercadoTop5Mensais`, `ExpectativasMercadoTrimestrais`, `ExpectativasMercadoInflacao12Meses`, `ExpectativasMercadoInflacao24Meses`, `ExpectativasMercadoSelic`, `ExpectativasMercadoTop5Selic`, `DatasReferencia`.

**Colunas principais:** `Indicador`, `Data`, `DataReferencia` (nas séries da Selic, `Reuniao`), `Media`, `Mediana`, `DesvioPadrao`, `Minimo`, `Maximo`, `numeroRespondentes`, `baseCalculo`. Os nomes variam um pouco entre conjuntos; leia o `$metadata`.

**Na tela:** usar a mediana e dizer que é a expectativa de instituições financeiras consultadas pelo Banco Central, não uma previsão oficial.

## Banco Central · PTAX

```http
GET https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='11-03-2026'&$format=json
```

A data vai no formato `MM-DD-AAAA`. Em fins de semana e feriados não há cotação: use o último dia útil. Status: `confirmar`.

## IBGE · API de Agregados v3 (SIDRA)

```http
GET https://servicodados.ibge.gov.br/api/v3/agregados/{tabela}/periodos/{periodos}/variaveis/{variaveis}?localidades=N1[all]
GET https://servicodados.ibge.gov.br/api/v3/agregados/{tabela}/metadados
```

- `N1[all]` é Brasil; `N3[all]` são as UFs.
- Variáveis podem ser combinadas com `|`. Períodos aceitam intervalos (`197912-202609`), listas e **últimos N como `-N`** (ex.: `/periodos/-3/`; testado em 01/11/2026).
- Com `curl`, use `-g` (os colchetes de `N1[all]` ativam o globbing do curl).
- Valor ausente vem como texto: `"..."` (não disponível) ou `"-"`. O coletor trata esses casos como ausência, nunca como zero.
- `GET /agregados/{tabela}/periodos` traz `modificacao` (dd/mm/aaaa) por período: é a data de divulgação/última alteração usada como "atualizado em".
- Sempre leia `/metadados` antes de usar uma tabela nova.
- O IBGE pode reorganizar tabelas; guarde o número da tabela e da variável junto com cada observação.

| Tabela | Variável | Conteúdo | Status |
|---|---|---|---|
| 1737 | 63 | IPCA, variação mensal | ok (testado em 01/11/2026: dez/1979 a set/2026; dez/1979 vem `...`) |
| 1737 | 2265 | IPCA, acumulado em 12 meses | ok (testado em 01/11/2026: valores a partir de dez/1980; antes vem `...`) |
| 1737 | 2266 | IPCA, número-índice (base dez/1993 = 100; usar como deflator) | ok (testado em 01/11/2026) |
| 7060 | 63 / 66 | IPCA por grupos e itens: variação / peso (classificação 315) | ok |
| 6381 | 4099 | Taxa de desocupação, trimestre móvel (PNAD Contínua). O período é o mês final do trimestre (202609 = jul–set/2026) | ok (testado em 01/11/2026: desde 201203) |
| 6390 | 5933 / 5929 | Rendimento médio mensal habitual de todos os trabalhos, real / nominal, trimestre móvel. O real vem a preços do trimestre mais recente e muda a cada divulgação | ok (testado em 01/11/2026: desde 201203) |
| 8529 | 12466 | Taxa de informalidade das pessoas ocupadas, trimestral | ok (testado em 01/11/2026: desde 201504) |
| 5932 | 6562 / 6564 | PIB, taxa acumulada em 4 trimestres / contra o trimestre anterior (com ajuste sazonal). Exige `classificacao=11255[90707]` (PIB a preços de mercado). Período AAAA0T = trimestre | ok (testado em 01/11/2026: desde 1996) |
| 6579 | — | População residente estimada | confirmar |

Calendário de divulgações: https://www.ibge.gov.br/calendario-de-divulgacoes.html (`confirmar` URL: em 01/11/2026 o site `www.ibge.gov.br` respondeu HTTP 403 a clientes automáticos; conferir num navegador).

**API do calendário (ok, testada em 01/11/2026):**
```http
GET https://servicodados.ibge.gov.br/api/v3/calendario/{produto}?de=MM-DD-AAAA&ate=MM-DD-AAAA
```
- Produtos usados: IPCA `9256`; PNAD Contínua mensal `9171` (referência = mês final do trimestre móvel); PNAD Contínua trimestral `9173` e Contas Nacionais Trimestrais `9300` (referência = 1º mês do trimestre). Testados em 01/11/2026.
- IPCA é o produto `9256`. Cada item traz `data_divulgacao` (`dd/mm/aaaa hh:mm:ss`, horário de Brasília) e o mês de referência em `ano_referencia_inicio` e `mes_referencia_inicio`.

**Malhas e localidades:**
```http
GET https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&intrarregiao=UF
GET https://servicodados.ibge.gov.br/api/v1/localidades/estados
```
Status: `confirmar`.

## Tesouro Nacional · Siconfi (estados e municípios)

```http
GET https://apidatalake.tesouro.gov.br/ords/siconfi/tt/entes
GET https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=2026&nr_periodo=4&co_tipo_demonstrativo=RREO&id_ente=35
GET https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rgf?an_exercicio=2026&in_periodicidade=Q&nr_periodo=2&co_tipo_demonstrativo=RGF&co_poder=E&id_ente=35
```

- Base `ok`. Nomes de parâmetros: `confirmar` na documentação: https://apidatalake.tesouro.gov.br/docs/siconfi/
- Relatórios: RREO (bimestral), RGF (quadrimestral, ou semestral para alguns municípios pequenos), DCA (anual), MSC (mensal).
- Paginação padrão de 5.000 linhas por página.
- Transferências constitucionais (FPE, FPM): `https://apiapex.tesouro.gov.br/aria/v1/transferencias_constitucionais/custom` (`confirmar` parâmetros).

## Tesouro Transparente

- Portal CKAN com planilhas e CSV, incluindo o Resultado do Tesouro Nacional (mensal) e estatísticas da dívida.
- Busca de conjuntos: `GET https://www.tesourotransparente.gov.br/ckan/api/3/action/package_search?q=resultado+do+tesouro` (`confirmar`).
- Planilhas mudam de layout às vezes. O coletor deve validar cabeçalhos e falhar com alerta, nunca ler em silêncio.

## Receita Federal · Arrecadação

- Relatório mensal de arrecadação das receitas federais e conjuntos em dados abertos (`confirmar` o conjunto exato e o formato).
- Relatório anual "Carga Tributária no Brasil": base para a parte indireta de F2 ([08](08-decisoes-em-aberto.md), D9).

## Portal da Transparência (CGU)

```http
GET https://api.portaldatransparencia.gov.br/api-de-dados/{recurso}?{parametros}&pagina=1
chave-api-dados: <SUA_CHAVE>
```

- Cadastro da chave: https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email (exige conta gov.br nível prata ou ouro).
- Limite: 400 requisições por minuto, ou 700 entre 0h e 6h. Passar do limite suspende a chave por 8 horas. Coletas grandes devem rodar de madrugada.
- Lista de recursos na documentação Swagger da própria API (`confirmar` URL).
- A chave fica em variável de ambiente, nunca no código.

## Câmara dos Deputados e Senado Federal (pós-MVP)

```http
GET https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=PL&ano=2026&keywords=imposto
GET https://dadosabertos.camara.leg.br/api/v2/votacoes/{id}/votos
GET https://dadosabertos.camara.leg.br/api/v2/votacoes/{id}/orientacoes
```

- Uma "votação da proposição X" costuma ser um conjunto de votações (parecer, emendas, destaques, redação final). Exiba isso com clareza.
- Senado: https://legis.senado.leg.br/dadosabertos/ (`confirmar` endpoints).

## Outras fontes oficiais (pós-MVP)

| Fonte | Uso | Acesso |
|---|---|---|
| TSE · Dados Abertos | Candidaturas, bens declarados, contas de campanha (eleições de 2028) | Portal CKAN em dadosabertos.tse.jus.br (`confirmar`) |
| IFI (Senado) | Projeções fiscais independentes | Relatórios e planilhas, sem API (`confirmar`) |
| Prisma Fiscal (Ministério da Fazenda) | Expectativas fiscais de mercado | Planilhas mensais (`confirmar`) |

## Base dos Dados

- Tabelas tratadas no BigQuery: `basedosdados.<conjunto>.<tabela>`. Pacote: `pip install basedosdados`.
- Cada projeto Google Cloud tem 1 TB de consulta grátis por mês.
- Uso: carga inicial de históricos longos. Na tela, sempre citar a fonte primária.

## Notícias

**GDELT DOC 2.0:**
```http
GET https://api.gdeltproject.org/api/v2/doc/doc?query=(inflação OR IPCA) sourcecountry:brazil sourcelang:portuguese&mode=artlist&format=json&maxrecords=250&timespan=1d
```
- Limite: uma requisição a cada 5 segundos (acima disso, HTTP 429).
- Cobre uma janela móvel de cerca de 3 meses.
- Valores aceitos em `sourcecountry` e `sourcelang`: `confirmar`.

**RSS dos veículos:**
- Lista em `config/news_sources.yaml` com nome, domínio, URL do feed e critério de inclusão.
- Guardar só título, link, data, veículo e trecho curto. Respeitar termos de uso e `robots.txt`.
- Google Notícias por RSS só depois de conferir os termos de uso.

**Google Fact Check Tools (checagens):**
```http
GET https://factchecktools.googleapis.com/v1alpha1/claims:search?query=IPCA&languageCode=pt-BR&key=<CHAVE>
```

---

## Modelo de registro de fonte

Todo indicador novo entra em `config/indicators.yaml` neste formato:

```yaml
- slug: ipca-12-meses
  titulo: Inflação em 12 meses (IPCA)
  fonte_primaria:
    orgao: IBGE
    tipo: ibge_agregados
    tabela: 1737
    variavel: 2265
    status: ok
  fonte_reserva:
    orgao: Banco Central
    tipo: bcb_sgs
    codigo: 13522
    status: ok
  unidade: "%"
  tipo_serie: taxa          # nivel | taxa
  frequencia: mensal
  janela_padrao: 5a
  monetaria: false
  frase_template: ipca_12m.pt.txt
  url_metodologia: https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor-amplo.html  # confirmar
```
