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
| Agendamento | GitHub Actions (cron) no MVP; Prefect ou Dagster quando passar de ~30 jobs | Começa grátis e simples |
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
- **Salto:** período novo ou revisado que varia mais do que a maior variação da série nos 10 anos anteriores (p.p. em taxa, % em nível) para a coleta daquela série. O site continua com o último valor válido até um humano conferir na fonte e registrar o valor exato, com link de evidência, em `config/aprovacoes.yaml`. Série com menos de 12 variações na janela (as anuais da PNAD) não é conferida e gera aviso (`pipelines/saltos.py`). No histórico de 2016 a 2026 a regra segurou 6 de 3.780 períodos, todos corretos e excepcionais (IPCA de mar e jul/2022, dólar em 26/10/2026), ou seja, sem alarme em mês comum.
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

Três agentes ajudam a operar sem tocar no dado: o **investigador de falhas** explica por
que uma coleta, um atraso ou uma auditoria falhou; o **revisor de mudanças** confere
alterações em `config/`, `pipelines/` e `docs/05` contra a fonte e as regras do projeto;
o **auditor de textos** confere frases e metodologia contra o [02](02-principios-de-neutralidade.md).
Eles explicam e apontam onde conferir. Quem grava é a coleta, e quem libera é uma pessoa,
pelo git (`config/aprovacoes.yaml`).

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
- **Núcleo** (`pipelines/agentes/nucleo.py`): `claude-opus-5-5`, saída em JSON com
  schema, até 25 turnos, uma chance de correção quando a verificação recusa, fallback
  do servidor em caso de recusa de segurança. Cada execução grava um JSONL em
  `data/agentes/registros/` com entrada, chamadas, ferramentas, saída, modelo e versão do
  prompt (verificação 3 acima).
- **Avaliação** (`pipelines/agentes/avaliar.py`): casos com causa conhecida em
  `pipelines/agentes/avaliacao/investigar.yaml`, incluindo uma tentativa de injeção numa
  resposta bruta. O revisor tem `pipelines/agentes/avaliar_revisor.py`, com erros
  plantados num git worktree descartável (`avaliacao/revisar.yaml`). Gasta API; rodar
  antes de mudar prompt ou modelo. Em 02/11/2026: investigador 6 de 6 (US$ 1,53),
  revisor 6 de 6 (US$ 0,44).
- **Credencial:** `AGENTES_DATABASE_URL`. Local: `postgresql://leitor:leitor@127.0.0.1:55322/postgres`
  (senha em `supabase/seed.sql`, que só roda no banco local). Produção: senha definida à
  mão no painel.

## Testes

- **Dados:** sem valores nulos, faixa plausível por série (ex.: Selic entre 0% e 50%), datas sem buracos, totais que batem com a fonte.
- **Transformações:** testes com casos conhecidos (ex.: IPCA acumulado de 12 meses calculado bate com o publicado pelo IBGE).
- **Interface:** testes de ponta a ponta das páginas principais e verificação automática de acessibilidade.
