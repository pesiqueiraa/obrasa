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
| TSE · Dados Abertos | Resultados das Eleições 2026 por município, candidaturas e eleitos | Zips no CDN do TSE, lidos por HTTP Range | Nenhuma | Por eleição |
| Tesouro · Siconfi | Contas de estados e municípios (pós-MVP) | API REST (ORDS) | Nenhuma | Bimestral e quadrimestral |
| Tesouro Transparente | Resultado do Tesouro, dívida | CKAN (planilhas e CSV) | Nenhuma | Mensal |
| Receita Federal | Arrecadação federal por tributo e UF | CSV em gov.br | Nenhuma | Mensal |
| Planalto · Legislação | Marcos da reforma tributária e do IR (aba Impostos) | Texto da lei, conferido à mão | Nenhuma | Quando a lei muda |
| Portal da Transparência (CGU) | Despesa por função, emendas | API REST | Chave gratuita | Diária |
| Câmara dos Deputados | Projetos sobre impostos (aba Impostos); votações (pós-MVP) | API REST | Nenhuma | Contínua |
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
| 24369 | Taxa de desocupação - PNADC (cópia da tabela 6381/4099 do IBGE) | % | Mensal (trimestre móvel) | ok (02/11/2026: igual ao IBGE nos 175 trimestres móveis de mar/2012 a set/2026; segunda fonte da desocupação) |
| 22099 | PIB trimestral, dados observados, índice (Contas Nacionais do IBGE) | Índice | Trimestral | ok (02/11/2026: a taxa em 4 trimestres calculada dele difere da tabela 5932/6562 em até 0,05 p.p. desde 1998, arredondamento; em 1997 a diferença chega a 1 p.p.; segunda fonte do PIB nos últimos 10 anos) |
| 22109 | PIB trimestral, dados dessazonalizados, índice | Índice | Trimestral | ok (02/11/2026: a taxa contra o trimestre anterior calculada dele difere da tabela 5932/6564 em até 0,06 p.p., arredondamento; segunda fonte nos últimos 10 anos) |
| 24382 | Rendimento médio real habitual das pessoas ocupadas - PNADC | R$ | Mensal | ok, mas **não serve de segunda fonte**: difere da tabela 6390/5933 em todos os 175 períodos (02/11/2026: R$ 3.676 contra R$ 3.790 em set/2026), provavelmente por outro mês-base do deflator |
| 5793 | NFSP sem desvalorização cambial (% PIB), fluxo acumulado em 12 meses, resultado primário, setor público consolidado | % | Mensal | ok (nome e unidade conferidos no webservice SGS em 02/11/2026; ainda não usada no site) |
| 4649 | NFSP sem desvalorização cambial, fluxo mensal corrente, resultado primário, setor público consolidado | R$ (milhões) | Mensal | ok (conferida no webservice SGS em 02/11/2026; ainda não usada) |
| 5364 | NFSP sem desvalorização cambial (% PIB), fluxo mensal corrente, resultado primário, setor público consolidado | % | Mensal | ok (conferida no webservice SGS em 02/11/2026; ainda não usada) |
| 5760 | NFSP sem desvalorização cambial (% PIB), fluxo acumulado em 12 meses, juros nominais, setor público consolidado | % | Mensal | ok (nome conferido no webservice SGS em 07/11/2026: 8,99 em set/2026) |
| 5727 | NFSP sem desvalorização cambial (% PIB), fluxo acumulado em 12 meses, resultado nominal, setor público consolidado | % | Mensal | ok (07/11/2026: 9,51 em set/2026 = primário 0,52 + juros 8,99; usada só como conferência) |

Atenção ao sinal das NFSP: necessidade de financiamento positiva é déficit. Conferido em 07/11/2026 contra o Focus, que publica o "Resultado primário" com o sinal do resultado (−0,49% do PIB esperado para 2026 enquanto a NFSP primária de 12 meses era +0,52%). O site exibe o resultado (sinal invertido da NFSP, transformação `inverter_sinal`), na mesma convenção do Focus: negativo é déficit.

Catálogo completo: https://www3.bcb.gov.br/sgspub/ (`confirmar`: respondeu HTTP 502 em 01/11/2026). Para nome, unidade e periodicidade de uma série, use o webservice abaixo.

**Webservice SGS (descrição e último valor)** · status `ok` (testado em 02/11/2026)

```http
POST https://www3.bcb.gov.br/wssgs/services/FachadaWSSGS
Content-Type: text/xml; charset=utf-8
SOAPAction: getUltimoValorXML

<soapenv:Envelope ...><pub:getUltimoValorXML><in0>{codigo}</in0></pub:getUltimoValorXML></soapenv:Envelope>
```

- A resposta SOAP traz, dentro de `getUltimoValorXMLReturn`, um XML em ISO-8859-1 com `NOME`, `CODIGO`, `PERIODICIDADE` (`D`, `M`), `UNIDADE`, `DATA` (dia, mês, ano) e `VALOR` com vírgula decimal.
- Código inexistente responde HTTP 500 (SOAP Fault).
- O coletor usa o webservice em toda coleta do SGS: nome, unidade e periodicidade precisam ser iguais a `na_fonte` em `config/sources.yaml`, e o último valor precisa ser igual ao da API JSON (dois serviços diferentes do BC). Ver `pipelines/metadados.py`.
- **Segunda fonte:** o BC republica no SGS séries do IBGE. Quando a cópia confere com o histórico completo, ela entra em `conferir_com` (`config/sources.yaml`) e a coleta da tabela do IBGE para se as duas discordarem (`pipelines/segunda_fonte.py`). Cópia que difere por método, como o rendimento 24382, não entra.
- A meta Selic (432) vem com a data da véspera da próxima reunião, no futuro: o coletor pede a API JSON até essa data e descarta o que passa de hoje.

Página de metodologia do IPCA no IBGE, citada em `config/indicators.yaml`: `confirmar` (HTTP 403 a clientes automáticos em 01/11/2026; conferir num navegador antes de exibir no site).

## Banco Central · Calendário do Copom

O Banco Central publica o calendário anual das reuniões do Copom só numa página montada no navegador, sem API (testado em 02/11/2026: `https://www.bcb.gov.br/controleinflacao/calendarioreunioescopom` devolve só o esqueleto da página; nenhum endpoint de calendário em `/api/servico/sitebcb/`). As datas ficam em `config/copom.yaml`, digitadas a partir dessa página, com a data em que o BC divulgou o calendário.

Conferência automática (status `ok`, testado em 02/11/2026):
```http
GET https://www.bcb.gov.br/api/servico/sitebcb/copom/comunicados?quantidade={N}
```
Resposta: `{"conteudo":[{"nro_reuniao":281,"dataReferencia":"2026-09-16","titulo":"281ª reunião - ..."}]}`. O job `agenda` (`pipelines/jobs/agenda.py`) compara cada reunião que já aconteceu com o número e o dia da decisão desses comunicados; se alguma data divergir, nada é gravado. Reuniões futuras não têm como ser conferidas antes de acontecer. robots.txt do BC: `Allow: /`.

- Calendário de 2026 (reuniões 276 a 283) divulgado pelo BC em 24/06/2025; as seis reuniões até setembro conferem com os comunicados. O de 2027 entra em `config/copom.yaml` quando o BC publicar (em geral, em junho); sem reunião futura, o job avisa.

## Banco Central · Focus (expectativas de mercado)

```http
GET https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$filter=Indicador eq 'IPCA' and DataReferencia eq '2027'&$orderby=Data desc&$top=10&$format=json
```

Codifique os espaços e aspas da URL. Documentação: https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/documentacao

**Conjuntos disponíveis (ok):** `ExpectativasMercadoAnuais`, `ExpectativasMercadoTop5Anuais`, `ExpectativaMercadoMensais`, `ExpectativasMercadoTop5Mensais`, `ExpectativasMercadoTrimestrais`, `ExpectativasMercadoInflacao12Meses`, `ExpectativasMercadoInflacao24Meses`, `ExpectativasMercadoSelic`, `ExpectativasMercadoTop5Selic`, `DatasReferencia`.

**Colunas principais:** `Indicador`, `Data`, `DataReferencia` (nas séries da Selic, `Reuniao`), `Media`, `Mediana`, `DesvioPadrao`, `Minimo`, `Maximo`, `numeroRespondentes`, `baseCalculo`. Os nomes variam um pouco entre conjuntos; leia o `$metadata`.

**Na tela:** usar a mediana e dizer que é a expectativa de instituições financeiras consultadas pelo Banco Central, não uma previsão oficial.

**Testado em 07/11/2026 (`ok`):** `ExpectativasMercadoAnuais` com `$filter=Data eq 'AAAA-MM-DD' and baseCalculo eq 0` devolve uma linha por indicador e ano de referência. `baseCalculo` 0 considera as respostas dos últimos 30 dias; 1, dos últimos 5 dias úteis (há as duas linhas para cada indicador). Usamos 0. Os espaços da URL vão como `%20`: com `+` a API responde 400.

| `Indicador` no Focus | Indicador do oBrasa | Unidade |
|---|---|---|
| `IPCA` | ipca-12-meses (variação no ano-calendário) | % |
| `Selic` | selic (taxa no fim do ano) | % a.a. |
| `PIB Total` | pib-4-trimestres (variação no ano) | % |
| `Câmbio` | dolar (taxa no fim do ano) | R$/US$ |
| `Taxa de desocupação` | desocupacao | % |
| `Resultado primário` | resultado-primario | % do PIB |
| `Dívida bruta do governo geral` | divida-bruta | % do PIB |
| `Dívida líquida do setor público` | divida-liquida | % do PIB |

Na pesquisa de 30/10/2026 havia 144 respondentes para o IPCA de 2026. A expectativa é sempre de um ano-calendário; o número da tela pode ser de outra janela (o IPCA de 12 meses, por exemplo). A tela diz o ano de referência.

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
- Sempre leia `/metadados` antes de usar uma tabela nova. O coletor também lê em toda coleta: nome e unidade da variável, periodicidade da tabela e nome de cada categoria filtrada precisam ser iguais a `na_fonte` no config (`pipelines/metadados.py`; testado em 02/11/2026).
- **O campo `unidade` da resposta de dados muda com o período pedido:** a tabela 1737 com `197912-202609` devolve unidade vazia para as variáveis 63 e 2265; com `-1` ou `202501-202609`, devolve `%` (testado em 02/11/2026). Por isso a unidade é conferida em `/metadados`, que não depende da consulta.
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
- O job `series` grava as datas de cada produto em `releases.proxima_divulgacao`; a página `/agenda` lê dali. Produtos usados: IPCA `9256`; PNAD Contínua mensal `9171` (referência = mês final do trimestre móvel); PNAD Contínua trimestral `9173` e Contas Nacionais Trimestrais `9300` (referência = 1º mês do trimestre). Testados em 01/11/2026.
- IPCA é o produto `9256`. Cada item traz `data_divulgacao` (`dd/mm/aaaa hh:mm:ss`, horário de Brasília) e o mês de referência em `ano_referencia_inicio` e `mes_referencia_inicio`.

**PNAD Contínua anual, módulo de educação** (testado em 02/11/2026, status `ok`). Tabelas anuais de 2016 a 2025; o código de período é só o ano (`2025`). Cada série filtra uma categoria de cada classificação, no formato `classificacao=2[6794]|58[2795]` (sexo = total e grupo de idade).

| Tabela | Variável | Categorias | Série |
|---|---|---|---|
| 7113 | 10267 | `2[6794]\|58[2795]` | Taxa de analfabetismo, 15 anos ou mais |
| 7126 | 3593 | `2[6794]\|58[108866]` | Média de anos de estudo, 25 anos ou mais |
| 7141 | 10282 | `2[6794]\|871[47818]` e `871[47819]` | Taxa ajustada de frequência escolar líquida: 15 a 17 anos no ensino médio; 18 a 24 anos no superior |
| 7138 | 10276 | `2[6794]\|58[99749]` | Taxa de escolarização, 0 a 3 anos |
| 7269 | 10270 | `2[6794]\|1568[11627, 48134, 48135, 99713]` | Distribuição das pessoas de 25 anos ou mais por nível de instrução (soma 100%, ±0,1 de arredondamento) |

- Não há 2020 nem 2021: o IBGE não publicou o módulo anual de educação desses anos. As séries declaram essas lacunas em `config/sources.yaml` (`lacunas`); qualquer outro buraco faz a coleta falhar.
- A divulgação de 2025 saiu em 19/06/2026 (campo `modificacao` da lista de períodos). Sem calendário coletado; o site considera atraso se o ano seguinte não sair até 14 de julho de dois anos depois do ano de referência.
- A tabela 7269 com a variável errada (4106, que não existe nela) responde HTTP 500, não 400.

**Por Unidade da Federação (mapas por estado, `config/regional.yaml`)** (testado em 02/11/2026, status `ok`). Mesmo endpoint, com `localidades=N3[all]`; a resposta traz as 27 UFs com `localidade.id` (código IBGE de 2 dígitos) e `localidade.nome`. O coletor (`pipelines/jobs/regional.py`) recusa resposta sem alguma das 27 UFs, com localidade que não é UF ou com valor fora da `faixa`.

| Tabela | Variável | Categorias | Série | Período |
|---|---|---|---|---|
| 4099 | 4099 | — | Taxa de desocupação, PNAD Contínua trimestral (a 6381, de trimestre móvel, só tem Brasil) | AAAA0T, desde 2012; o job guarda os últimos 20 trimestres |
| 7113 | 10267 | `2[6794]\|58[2795]` | Taxa de analfabetismo, 15 anos ou mais | anual, 2016 a 2025 |
| 7126 | 3593 | `2[6794]\|58[108866]` | Média de anos de estudo, 25 anos ou mais | anual, 2016 a 2025 |

**Malhas e localidades:**
```http
GET https://servicodados.ibge.gov.br/api/v1/localidades/municipios
GET https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/json&intrarregiao=municipio&qualidade=minima
GET https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/json&intrarregiao=UF&qualidade=minima
```
Status: `ok` (testado em 01/11/2026).
- `localidades/municipios` devolve 5.571 municípios (código IBGE de 7 dígitos, nome, UF).
- `formato=application/json` devolve TopoJSON (objetos `BRMU` e `BRUF`, código em `properties.codarea`). Municípios em qualidade mínima: 1,4 MB.
- A malha tem 5.570 polígonos: Boa Esperança do Norte (MT, 5101837) está na lista de municípios mas ainda não tem desenho. A página de eleições avisa isso abaixo do mapa.

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

```http
GET https://www.gov.br/receitafederal/dados/arrecadacao-estado.csv
```

Status `ok` (testado em 07/11/2026). CSV em ISO-8859-1, separado por `;`, com vírgula decimal e quebra de linha CRLF. Uma linha por ano, mês (nome por extenso: `Janeiro`…) e UF; uma coluna por tributo, em reais correntes. Começa em jan/2000; em 07/11/2026 ia até set/2026 (cerca de 2,4 MB).

- As colunas mudam com o tempo: CPMF até 2007; `COFINS`, `PIS/PASEP` e `CSLL` sem quebra só nos primeiros anos, depois `- FINANCEIRAS` e `- DEMAIS`; `RECEITA PREVIDENCIÁRIA` aparece como `- PRÓPRIA` e `- DEMAIS` em alguns anos. Nunca há total e quebra preenchidos no mesmo ano (conferido de 2000 a 2026), então a soma das colunas não conta nada duas vezes. O coletor confere isso a cada leitura e falha se os dois aparecerem juntos.
- Soma das 27 UFs em set/2025: R$ 216,7 bilhões; em set/2026: R$ 239,4 bilhões. `confirmar` contra o total do relatório mensal da Receita (o site `gov.br/receitafederal` não foi conferido num navegador nesta sessão).
- Agrupamento em tributos, público, em `config/impostos.yaml` (`arrecadacao.grupos`). Coluna nova sem grupo faz a coleta falhar.
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

**Projetos sobre impostos (aba Impostos)** · status `ok` (testado em 07/11/2026):

```http
GET https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=PEC,PLP,PL&keywords=imposto&dataInicio=AAAA-MM-DD&ordem=DESC&ordenarPor=id&itens=100
Accept: application/json
```

- `keywords` procura na ementa e na indexação. Só com `imposto`, de 01/01 a 07/11/2026 vieram cerca de 215 PEC, PLP e PL. Por isso a aba mostra só os que tiveram tramitação nos últimos 30 dias (`dataInicio`), e a lista de termos fica pública em `config/impostos.yaml`.
- A situação atual vem de `GET /proposicoes/{id}` (`statusProposicao`). Proposição na tela tem o selo de proposta: não é lei.
- Os temas (`/referencias/proposicoes/codTema`) não têm um tema só de tributação (há 40 Economia e 70 Finanças Públicas e Orçamento); não usamos o filtro por tema.

## TSE · Dados Abertos (Eleições 2026)

Status: `ok` (testado em 01/11/2026). Configuração em `config/eleicoes.yaml`, job em `pipelines/jobs/eleicoes.py`.

| Arquivo (dentro do zip) | Zip no CDN | Uso |
|---|---|---|
| `detalhe_votacao_munzona_2026_BR.csv` | `cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_2026.zip` | Aptos, comparecimento, abstenção, válidos, brancos e nulos para presidente, por município e zona |
| `votacao_candidato_munzona_2026_BR.csv` | `.../votacao_candidato_munzona/votacao_candidato_munzona_2026.zip` (454 MB) | Votos de cada candidato a presidente por município e zona |
| `consulta_cand_2026_BRASIL.csv` | `.../consulta_cand/consulta_cand_2026.zip` | Candidaturas e situação no turno (eleitos de cada cargo) |

Páginas: https://dadosabertos.tse.jus.br/dataset/resultados-2026 e https://dadosabertos.tse.jus.br/dataset/candidatos-2026.

- O CDN aceita `Range: bytes=`; o job lê o diretório do zip e baixa só o arquivo pedido (cerca de 3 MB no total).
- CSV em latin-1, separado por `;`. `DT_GERACAO`/`HH_GERACAO` dizem quando o TSE gerou o arquivo. Códigos de eleição: 6257 (presidente, 1º turno), 6258 (2º turno).
- `CD_MUNICIPIO` é o código do TSE, não o do IBGE. O arquivo de votação por candidato escreve sem zeros à esquerda; o de detalhe, com 5 dígitos.
- Conferências feitas a cada coleta (falha = nada gravado): aptos = comparecimento + abstenções + eleitores de seções não instaladas; comparecimento = válidos + brancos + nulos; soma dos votos por candidato = válidos, em cada município e turno; número de eleitos = vagas de cada cargo.
- Casamento TSE → IBGE por UF e nome normalizado; 13 nomes diferentes ficam como exceção em `config/eleicoes.yaml`. O casamento tem de ser um para um e cobrir os 5.571 municípios.
- Dos arquivos de candidaturas só são lidos campos públicos de exibição (número, nome de urna, partido, federação, situação). CPF, e-mail, título de eleitor e data de nascimento não são lidos.
- O feed de resultados `resultados.tse.jus.br/oficial/.../dados-simplificados/...` respondeu 404 em 01/11/2026; não é usado.

**Planos de governo (propostas registradas)** · status `ok` só para acesso (testado em 07/11/2026), ainda não usado:

- Um zip por UF e um para presidente: `cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_2026_{UF|BR}.zip` (BR: 18 MB, 14 PDFs e um `leiame.pdf`).
- Cada PDF se chama `{UF}/2026{UF}{SQ_CANDIDATO}_{n}.pdf`. O `SQ_CANDIDATO` liga o plano ao arquivo `consulta_cand`, que já é lido.
- Só presidente e governador registram plano. Deputados e senadores não.
- A API do DivulgaCandContas (`divulgacandcontas.tse.jus.br/divulga/rest/v1/...`) respondeu 403 a clientes automáticos em 07/11/2026; não usar.
- Uso planejado em [10](10-pos-mvp.md#38-acompanhar-os-eleitos), com a regra de [02](02-principios-de-neutralidade.md#10-promessas-e-mandatos).

## Planalto · Legislação (aba Impostos)

- Fonte dos marcos da reforma tributária e do imposto de renda. Não há API: cada marco é escrito à mão em `config/impostos.yaml`, com lei, artigo e link para o texto compilado em `planalto.gov.br`, e conferido por uma pessoa antes de ir para a tela.
- Um job carrega o arquivo no banco (`marcos_tributarios`), para que a tela leia o número do banco como qualquer outro (regra 1). O link da lei é a fonte exibida.
- Lei citada sempre na versão compilada, porque as leis da reforma são alteradas com frequência.

## Outras fontes oficiais (pós-MVP)

| Fonte | Uso | Acesso |
|---|---|---|
| TSE · Dados Abertos | Bens declarados e contas de campanha (resultados de 2026 já em uso, ver acima) | Portal CKAN em dadosabertos.tse.jus.br (`confirmar` para estes conjuntos) |
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

**RSS dos veículos** (`ok`, testado em 02/11/2026):
- Lista em `config/noticias.yaml` com nome, domínio, endereço do feed e critério de inclusão. Coletor: `pipelines/sources/rss.py`; job: `pipelines/jobs/noticias.py`, a cada 30 minutos (`.github/workflows/noticias.yml`).
- 16 veículos com feed respondendo 200 e permitido pelo `robots.txt` para o agente "oBrasa". O coletor confere o `robots.txt` antes de cada coleta e não segue redirecionamento.
- Fora da lista em 02/11/2026: CNN Brasil (o feed redireciona para `admin.cnnbrasil.com.br`, cujo `robots.txt` bloqueia tudo) e Correio Braziliense (o endereço do feed devolve HTML).
- Formatos tratados: links de contagem de cliques da Folha (`redir.folha.com.br/...*https://...`, usa-se o destino), prefixos XML sem declaração (Revista Oeste), feed sem declaração XML em ISO-8859-1 (UOL, `rss.uol.com.br/feed/noticias.xml`; `economia.xml` devolve HTML e `politica.xml` dá 404), parâmetros de rastreamento (`utm_*`, `at_*`) e conteúdo publicitário (`especial-publicitario`), que fica de fora.
- Guardar só título, link, data, veículo, trecho de até 200 caracteres da descrição do feed e o endereço da imagem de destaque que o feed indica (regra 7). `content:encoded` nunca é lido.
- Imagem: `media:content`/`media:thumbnail`, `enclosure` de imagem, `<imagem-destaque>` (Agência Brasil) ou `<img>` da descrição. Ficam de fora logotipos, pixels de contagem de 1px e a mesma imagem repetida em 3 ou mais itens. Em 02/11/2026, sem imagem no feed: Exame, Folha, Poder360 e UOL; Estadão só em parte. BBC manda 240px e o mesmo servidor entrega 800px (`/ace/ws/800/`).
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
