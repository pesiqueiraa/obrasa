# 06 · Arquitetura e stack

## Visão geral

```mermaid
flowchart LR
  subgraph Fontes oficiais
    A1[Banco Central]
    A2[IBGE]
    A3[Tesouro / Receita / CGU]
    A4[RSS + GDELT]
    A5[Google Fact Check]
  end
  subgraph Pipeline Python
    B1[Coletores] --> B2[(Respostas brutas)]
    B2 --> B3[Normalização]
    B3 --> B4[Transformações<br/>deflação, acumulados,<br/>per capita, % PIB]
    B1 --> N1[Notícias: dedupe,<br/>tema, embeddings,<br/>agrupamento]
  end
  subgraph Supabase
    C1[(Postgres + pgvector)]
    C2[(Storage: brutos)]
  end
  subgraph Web
    D1[Next.js]
  end
  A1 & A2 & A3 & A4 & A5 --> B1
  B2 --> C2
  B4 --> C1
  N1 --> C1
  C1 --> D1
```

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Coleta e transformação | Python 3.12, `httpx`, `pandas` ou `polars`, `pydantic` | Ecossistema maduro para dados públicos brasileiros |
| Agendamento | GitHub Actions no MVP; as notícias, a cada 30 min, disparadas pelo `pg_cron` do Supabase (o cron do GitHub descartou ~9 em 10 horários em nov/2026); Prefect ou Dagster quando passar de ~30 jobs | Começa grátis e simples |
| Banco | Postgres no Supabase, com `pgvector` | Relacional, com busca vetorial para notícias, e já conectado ao projeto |
| Respostas brutas | Supabase Storage (ou S3), em JSON ou CSV com hash | Rastreabilidade e reprocessamento |
| Histórico analítico | Parquet + DuckDB | Consultas rápidas em séries longas sem pesar o Postgres |
| Web | Next.js (App Router), renderização estática com revalidação | Rápido no celular e bom para SEO |
| Componentes de interface | `@carbon/react` com tema próprio | Base do [DESIGN.md](../DESIGN.md); open source (Apache 2.0) |
| Gráficos | `@carbon/charts-react`; ECharts para o que faltar (ex.: Sankey) | Combina com o design system |
| Mapas | Malhas do IBGE em GeoJSON | Fonte oficial |
| IA | Um LLM via API, só para as tarefas permitidas abaixo | Ver "Regras de uso de IA" |
| Hospedagem | Vercel (web) + Supabase + GitHub Actions | Custo baixo no início |

## Estrutura sugerida do repositório

```text
/
├── AGENTS.md                 # regras do README de docs/, para o agente ler sempre
├── DESIGN.md                 # design system do oBrasa
├── design/
│   └── base/                 # bases fixas (IBM e WIRED), não editar
├── apps/
│   └── web/                  # Next.js
├── pipelines/
│   ├── sources/              # um módulo por fonte: bcb_sgs.py, bcb_focus.py, ibge_agregados.py...
│   ├── transforms/           # deflação, acumulados, per capita, % PIB
│   ├── news/                 # coleta, tema, embeddings, agrupamento
│   └── tests/
├── config/
│   ├── indicators.yaml       # registro de indicadores (formato em 05)
│   ├── news_sources.yaml     # veículos e feeds
│   ├── tax_tables/           # tabelas de INSS e IR por ano (F2)
│   └── templates/            # frases "o que significa para você"
├── supabase/
│   └── migrations/
└── docs/                     # esta pasta
```

## Modelo de dados

```sql
create table sources (
  id text primary key,                -- ex.: 'bcb_sgs', 'ibge_agregados'
  nome text not null,
  orgao text not null,
  url_documentacao text,
  url_metodologia text,
  licenca text
);

create table series (
  id text primary key,                -- ex.: 'bcb_sgs_432'
  source_id text references sources(id),
  codigo_externo text not null,       -- código na fonte (432, '1737/2265'...)
  nome text not null,
  unidade text not null,
  frequencia text not null,           -- diaria | mensal | trimestral | anual | evento
  tipo text not null,                 -- nivel | taxa
  monetaria boolean not null default false,
  inicio date,
  nota_metodologia text
);

create table observations (
  series_id text references series(id),
  ref_date date not null,             -- primeiro dia do período de referência
  value numeric not null,
  revision int not null default 0,    -- revisões da fonte criam nova linha
  collected_at timestamptz not null,
  raw_object text not null,           -- caminho da resposta bruta no Storage
  primary key (series_id, ref_date, revision)
);

create table indicators (
  slug text primary key,
  titulo text not null,
  series_id text references series(id),
  fallback_series_id text references series(id),
  transformacao text,                 -- ex.: 'acumulado_12m', 'real_ipca'
  janela_padrao text not null,        -- 12m | 5a | 10a | tudo
  frase_template text not null,
  ordem int
);

create table releases (
  series_id text references series(id),
  ref_date date,
  divulgado_em timestamptz,
  proxima_divulgacao date
);

create table corrections (
  id bigserial primary key,
  data timestamptz not null default now(),
  indicador_slug text references indicators(slug),
  descricao text not null,
  antes text,
  depois text
);

create table outlets (
  id text primary key,
  nome text not null,
  dominio text not null,
  feed_url text
);

create table news_articles (
  id bigserial primary key,
  outlet_id text references outlets(id),
  url text unique not null,
  titulo text not null,
  publicado_em timestamptz,
  trecho text,                        -- curto; nunca o texto da matéria
  temas text[],
  embedding vector(1024),             -- dimensão depende do modelo escolhido
  cluster_id bigint
);

create table news_clusters (
  id bigserial primary key,
  criado_em timestamptz default now(),
  titulo_neutro text,
  indicadores text[]                  -- slugs relacionados
);

create table fact_checks (
  id bigserial primary key,
  cluster_id bigint references news_clusters(id),
  afirmacao text,
  classificacao text,
  agencia text,
  url text unique,
  data date
);
```

## Convenções

- **Datas:** `ref_date` é sempre o primeiro dia do período (março de 2026 = `2026-03-01`). Exibição no fuso `America/Sao_Paulo`.
- **Números:** `numeric` no banco, nunca `float`, para valores monetários.
- **Unidade sempre explícita** na série e na tela.
- **Deflator padrão:** número-índice do IPCA (IBGE, tabela 1737, variável 2266), com base no mês mais recente disponível.
- **Revisões:** nunca sobrescrever. Revisão da fonte vira nova linha com `revision + 1`; a tela usa a mais recente e a página de metodologia mostra o histórico. O banco garante a regra: `observations`, `observacoes_uf` e as tabelas de votos recusam UPDATE, DELETE e TRUNCATE (triggers `so_insert`), e o pipeline roda com o papel `coletor`, sem permissão de mudar o schema (migração `20261109000000_integridade.sql`).
- **Falhas:** coletor que não consegue validar a resposta falha com alerta. Nunca grava dado parcial ou com layout diferente do esperado.
- **Descrição na fonte:** antes de baixar os dados, o coletor confere nome, unidade, periodicidade e categorias da série no webservice SGS ou em `/metadados` do IBGE contra `na_fonte` no config. Qualquer diferença para a coleta: a fonte pode ter mudado o significado do código sem mudar o formato (`pipelines/metadados.py`).
- **Salto:** período novo ou revisado que varia mais do que a maior variação da série nos 10 anos anteriores (p.p. em taxa, % em nível) para a coleta daquela série. O site continua com o último valor válido até a liberação automática: (a) a segunda fonte da série (`conferir_com`) publica o mesmo valor, e o salto passa na hora; ou (b) a fonte mantém o mesmo valor para o período por 20 horas, e o salto passa na coleta do dia seguinte. Cada salto visto e cada liberação, com o motivo, ficam em `saltos_vistos` (só INSERT). Enquanto espera, o salto é aviso, não erro: não abre alerta. Erro de leitura nosso (coluna ou escala trocada) não depende desta trava: o valor de referência, a auditoria do bruto e a descrição na fonte pegam. Liberação manual em `config/aprovacoes.yaml` continua possível, mas não é necessária. Série com menos de 12 variações na janela (as anuais da PNAD) não é conferida e gera aviso (`pipelines/saltos.py`). No histórico de 2016 a 2026 a regra segurou 6 de 3.780 períodos, todos corretos e excepcionais (IPCA de mar e jul/2022, dólar em 26/10/2026), ou seja, sem alarme em mês comum.
- **Valor de referência:** cada série tem em `referencia` um período antigo (2019) e o valor que a fonte publicava para ele. `pytest -m network`, que roda antes de cada coleta, busca esse período pelo mesmo parser da coleta e exige o mesmo valor. Pega código que passou a apontar para outra série, parser lendo a coluna errada, escala trocada na fonte e revisão de período fechado (`pipelines/referencia.py`). As três séries que a fonte recalcula inteiras a cada divulgação (ajuste sazonal, rendimento real) ficam com `sem_valor_fixo` e o motivo. O config recusa série sem `referencia`.
- **Segunda fonte:** desocupação e PIB trimestral são conferidos contra as cópias que o BC publica no SGS (`conferir_com`, `pipelines/segunda_fonte.py`). O IPCA já era conferido contra o SGS 433 e 13522.
- **Coerência do config:** `config.load()` recusa indicador cuja unidade, frequência ou tipo difere da série que ele mostra, e indicador monetário sem série nominal (regra 3).
- **Auditoria do bruto:** `pipelines.run auditar` relê cada resposta bruta citada no banco, confere o SHA-256 gravado na coleta e reprocessa com o mesmo parser: todo valor do banco precisa sair igual do bruto (em 02/11/2026: 30 respostas, 23.680 linhas, nenhuma divergência).
- **Auditoria da tela:** `pnpm --filter @brasilado/web auditar-tela <url>` abre a página de cada indicador e confere série, período, valor e órgão da fonte contra o banco, com regra própria, sem reaproveitar `src/lib` (`apps/web/scripts/auditar-tela.mjs`).

## Agendamento inicial

| Job | Quando | Observação |
|---|---|---|
| BCB SGS (diárias) | Dias úteis, 9h e 18h | Selic, câmbio |
| BCB SGS (mensais) | Diariamente, 10h | Pega a divulgação quando sair |
| Focus | Segunda-feira, 10h | Relatório semanal |
| PTAX | Dias úteis, 13h30 e 18h | |
| IBGE | Diariamente, 10h | Compara com o calendário de divulgações |
| Tesouro e Receita | Diariamente, 18h | Divulgações mensais |
| Notícias (RSS) | A cada 15 min | |
| Notícias (GDELT) | A cada 15 min | Respeitar 1 requisição a cada 5 s |
| Agrupamento e checagens | A cada hora | |
| Verificação de atraso | Diariamente, 20h | Alerta se algum indicador ou mapa por estado passou do prazo (`atrasos.yml`). Sem calendário da fonte, vale o `prazo` da série em `config/sources.yaml` ou o padrão da frequência |

### Vigia e alertas

A esteira roda sem ninguém olhando; duas peças dizem quando algo precisa de uma pessoa.

- **Registro de execuções:** cada `python -m pipelines.run <job>` grava uma linha em
  `execucoes` (migração `20261112000000_execucoes.sql`) ao terminar, com sucesso ou não:
  horário, resultado, linhas novas e revisadas, erros e avisos. Só INSERT, como as tabelas
  de dado. O público lê só job, horário e resultado; o texto dos erros fica para o coletor
  e para o papel `leitor` dos agentes.
- **Vigia (`/saude`):** responde 200 se cada job de `config/saude.yaml` rodou dentro do
  prazo e se a notícia mais recente tem menos de 24 horas; 503 se não, ou se o banco não
  responde. Mede se a esteira roda, não se acerta: falha é assunto do alerta abaixo. Um
  monitor de fora do GitHub consulta `/saude` a cada poucos minutos e avisa por e-mail.
  Pega o caso que nada dentro do GitHub pega: o próprio GitHub parar de rodar os
  agendamentos (num repositório público, ele os desliga depois de 60 dias sem commit).
- **Alerta por issue (`scripts/alerta.py`):** último passo dos quatro workflows
  agendados. Primeira falha: nada (fonte fora do ar por algumas horas se resolve sozinha,
  e o site continua com o último valor validado). Falhou também na execução anterior e não
  há issue aberta: abre "Alerta: <job>" com os erros, o link da execução e, na coleta, o
  diagnóstico do investigador de falhas, que roda sozinho quando a coleta falha. Falhou de
  novo com os mesmos erros: só atualiza a issue, sem notificar. Erros diferentes: comenta.
  Voltou a funcionar: comenta e fecha. Auditoria e backup (`ALERTA_IMEDIATO=1`) abrem na
  primeira falha. Um feed fora do ar a cada 30 minutos vira uma issue, não 48 e-mails por dia.
- **Descrição que muda só de forma** (maiúscula, acento, pontuação) passa com aviso no log
  (`pipelines/metadados.py`); mudança de palavra, número ou unidade para a série.

- **Ponte do IBGE (`/api/ponte-ibge`, `apps/web/src/lib/ponte.ts`):** a API do IBGE
  (`servicodados.ibge.gov.br`) recusa conexões de fora do Brasil, e o GitHub Actions roda
  nos EUA (diagnóstico de 02/11/2026: Banco Central, SIDRA, Tesouro e feeds respondem; essa
  API não abre conexão). A coleta pede ao IBGE por uma função da Vercel em São Paulo
  (`vercel.json`, região `gru1`), que repassa o corpo sem mudar; a resposta bruta guarda a
  URL do IBGE. Fechada por padrão: só responde com o token `PONTE_IBGE_TOKEN`, só GET e só
  para essa API. Sem `IBGE_PONTE_URL` e `IBGE_PONTE_TOKEN` (máquina local), a coleta vai
  direto ao IBGE.
- **Reportes de erro (`/reportar-erro`, migração `20261113000000_reportes.sql`):** o site
  só chama a função `registra_reporte`; não lê nem altera a tabela `reportes`. Não guarda
  nome, e-mail nem IP. Contra spam: campo isca e tempo mínimo no formulário, e no banco
  um limite de 30 reportes por hora. O job `atrasos` mantém aberta a issue "Reportes de
  erro aguardando leitura" enquanto houver reporte `novo` (`scripts/reportes.py`), só com
  a contagem: o repositório é público e o texto do reporte não é.
- **Cópia de segurança (`pipelines/backup.py`, `backup.yml`):** toda semana, dump do
  schema `public` e as respostas brutas novas vão para o Cloudflare R2, fora do Supabase.
  Ficam as últimas 12 semanas de dump; as respostas brutas nunca são apagadas (o caminho
  leva o hash, então cada arquivo é copiado uma vez e conferido contra o hash do nome). O
  restauro é testado a cada cópia: o dump volta do R2, é restaurado num Postgres vazio e
  cada tabela precisa ter as linhas contadas antes do dump. Passo a passo da conta em
  [11](11-producao.md).

## Regras de uso de IA

**Permitido:**
- Classificar o tema de uma notícia.
- Gerar o título neutro de um grupo de notícias.
- Extrair afirmações de um texto para buscar checagens.
- No pós-MVP, responder perguntas com dados do banco, citando a série ([10](10-pos-mvp.md)).

**Proibido:**
- Gerar, estimar ou completar valores.
- Fazer previsões ou dar opinião.
- Escrever as frases "o que significa para você" (essas vêm de template).

**Verificações automáticas em toda saída de IA:**
1. Todo número na saída precisa aparecer na fonte de entrada ou no banco. Se não aparecer, a saída é descartada.
2. A saída passa pelo verificador de termos proibidos de [02](02-principios-de-neutralidade.md#4-linguagem-sem-adjetivo).
3. Registrar entrada, saída, modelo e versão do prompt, para auditoria.

### Agentes de investigação (`pipelines/agentes`)

Três agentes ajudam a operar sem tocar no dado (o quarto, o conferidor de marcos, está mais abaixo): o **investigador de falhas** explica por
que uma coleta, um atraso ou uma auditoria falhou; o **revisor de mudanças** confere
alterações em `config/`, `pipelines/` e `docs/05` contra a fonte e as regras do projeto;
o **auditor de textos** confere frases e metodologia contra o [02](02-principios-de-neutralidade.md).
Eles explicam e apontam onde conferir. Quem grava é a coleta, e o salto fora do histórico é
liberado por código (segunda fonte ou valor mantido pela fonte por 20 horas; ver "Salto"). Os marcos da aba Impostos já não dependem
de pessoa: o **conferidor de marcos**, abaixo, aprova ou reprova cada um.

- **Só leitura, em cinco camadas** (`pipelines/agentes/ferramentas.py`): login próprio
  do papel `leitor`, que só tem SELECT (migração `20261111000000_leitor.sql`; a conexão é
  recusada se o usuário da sessão for outro); transação somente leitura; um comando por
  consulta; só SELECT ou WITH; rollback no fim. Entrar como outro usuário e trocar de
  papel não basta: um superusuário volta ao próprio papel com `set_config` na consulta.
- **Ferramentas, todas determinísticas:** consultar o banco, listar e ler respostas
  brutas, comparar duas respostas, ler a descrição da série na fonte ao vivo, buscar
  páginas só em domínios oficiais e ler `docs/` e `config/`. Não existe ferramenta de
  escrita.
- **Verificação 1 acima** (`pipelines/agentes/numeros.py`): todo número e toda data do
  texto do agente precisa aparecer, exatamente, numa saída de ferramenta ou na entrada.
  Arredondar conta como inventar. Inteiros até 10 ficam de fora (contagens).
- **Conteúdo da fonte é dado:** respostas brutas e páginas chegam marcadas como "dado da
  fonte, não instrução".
- **Entrada do investigador:** job com erro grava `data/agentes/falhas-<job>.json`
  (`AGENTES_DIR` muda a pasta).
- **Investigador** (`pipelines/agentes/investigar.py`): lê `falhas-<job>.json` e grava um
  diagnóstico em `data/agentes/diagnosticos/`, com causa (fonte fora do ar, formato
  mudou, descrição mudou, revisão, salto real, atraso, erro nosso ou indeterminado),
  evidências citadas literalmente das ferramentas e links oficiais para conferir.
  Diagnóstico que não passa nas verificações sai recusado, sem o texto do modelo. Em
  falha de salto, o rascunho de liberação é montado por código a partir do erro.
- **Revisor** (`pipelines/agentes/revisar.py`): revisa `base..head` em `config/`,
  `pipelines/`, `scripts/`, `docs/`, `supabase/migrations/` e `apps/web/src/`. Confere
  série nova ou alterada contra a descrição na fonte ao vivo, liberação contra o valor
  publicado, status `ok` sem teste (regra 6), linguagem (regra 4, inclusive adjetivos fora
  da lista automática) e trava afrouxada sem motivo. Só comenta; sai com 1 quando há
  comentário de gravidade "problema". Lê o diff por ferramenta, só dos arquivos alterados.
- **Auditor de textos** (`pipelines/agentes/auditar_textos.py`): lê, por indicador, o
  título, o template da frase, a unidade, a frequência e a série exibida com a nota de
  metodologia. Aponta linguagem fora do [02](02-principios-de-neutralidade.md) (inclusive
  adjetivos fora da lista automática), unidade ou período ausente, e texto que descreve
  outra coisa que o config ou a fonte (escala, unidade, tabela e variável). Grava em
  `data/agentes/auditorias/` e sai com 1 quando há achado de gravidade "problema". Roda
  semanalmente quando entrar em produção. Primeira rodada nos textos atuais (02/11/2026):
  nenhum problema e três pontos de atenção (definição de informalidade resumida na frase,
  base do índice do IBC-Br, mês-base do rendimento na frase).
- **Conferidor de marcos** (`pipelines/agentes/conferir_marcos.py`): o único agente cuja
  resposta muda o que aparece no site, e só para esconder. Cada marco da aba Impostos passa
  por três camadas: números e datas do marco precisam existir no texto do artigo citado
  (código, sem IA); o modelo diz se a lei sustenta cada afirmação, com o trecho literal;
  o código confere que cada trecho existe na lei (ou num dispositivo que o modelo leu pela
  ferramenta `ler_dispositivo`). Aprovado vira `conferido_em`; reprovado fica fora da tela.
  O resultado vai para `marcos_verificacoes` (só INSERT) com o hash do marco, do texto da
  lei, do modelo e da versão do prompt: sem mudança, nada é chamado de novo. Resposta
  inválida, erro da API ou limite de turnos ficam como inconclusivos e são tentados de novo
  na execução seguinte. Teto de 20 chamadas por execução (`CHAMADAS_MAX`).
- **Núcleo** (`pipelines/agentes/nucleo.py`): `claude-opus-5-5`, saída em JSON com
  schema, até 25 turnos, uma chance de correção quando a verificação recusa, fallback
  do servidor em caso de recusa de segurança. Cada execução grava um JSONL em
  `data/agentes/registros/` com entrada, chamadas, ferramentas, saída, modelo e versão do
  prompt (verificação 3 acima).
- **Avaliação** (`pipelines/agentes/avaliar.py`): casos com causa conhecida em
  `pipelines/agentes/avaliacao/investigar.yaml`, incluindo uma tentativa de injeção numa
  resposta bruta. O revisor tem `pipelines/agentes/avaliar_revisor.py`, com erros
  plantados num git worktree descartável (`avaliacao/revisar.yaml`), e o auditor tem
  `pipelines/agentes/avaliar_auditor.py` (`avaliacao/auditar_textos.yaml`, com os textos
  atuais como caso limpo e uma tentativa de injeção num comentário de template). Gasta
  API; rodar antes de mudar prompt ou modelo. Em 02/11/2026: investigador 6 de 6
  (US$ 1,53), revisor 6 de 6 (US$ 0,44), auditor 6 de 6 (US$ 0,73).
- **Credencial:** `AGENTES_DATABASE_URL`. Local: `postgresql://leitor:leitor@127.0.0.1:55322/postgres`
  (senha em `supabase/seed.sql`, que só roda no banco local). Produção: senha definida à
  mão no painel.

## Testes

- **Dados:** sem valores nulos, faixa plausível por série (ex.: Selic entre 0% e 50%), datas sem buracos, totais que batem com a fonte.
- **Transformações:** testes com casos conhecidos (ex.: IPCA acumulado de 12 meses calculado bate com o publicado pelo IBGE).
- **Interface:** testes de ponta a ponta das páginas principais e verificação automática de acessibilidade.
