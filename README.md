# oBrasa

> Nome provisório. Dados oficiais do Brasil, com contexto e sem lado.

A documentação do produto (visão, regras de neutralidade, fontes, arquitetura) está em [docs/README.md](docs/README.md). O design system está em [DESIGN.md](DESIGN.md). Agentes de IA seguem [AGENTS.md](AGENTS.md).

## Estrutura

```text
apps/web/            Next.js (App Router) + @carbon/react
pipelines/           coletores (sources/), transformações (transforms/), jobs/ e testes
config/              indicators.yaml, sources.yaml, templates/ das frases, forbidden_terms.yaml
supabase/migrations/ modelo de dados (docs/06)
scripts/             verificador de termos proibidos
design/base/         bases fixas do design system (não editar)
docs/                documentação do produto
```

Caminho de um número: fonte oficial → coletor → resposta bruta no Storage → validação → `observations` (com revisões) → página.

## Desenvolvimento

Requisitos: Docker, [Supabase CLI](https://supabase.com/docs/guides/local-development), [uv](https://docs.astral.sh/uv/), Node 24 e pnpm.

```bash
# 1. Banco local (portas 553xx; ver supabase/config.toml)
supabase start

# 2. Dependências
uv sync
pnpm install

# 3. Coleta do IPCA (IBGE + Banco Central) para o banco local
eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY|DB_URL)=')"
DATABASE_URL="$DB_URL" SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  uv run python -m pipelines.run todos

# 4. Web (copie apps/web/.env.example para apps/web/.env.local e preencha com API_URL e ANON_KEY)
pnpm dev   # http://localhost:3000/indicador/ipca-12-meses
```

Agentes de IA (`pipelines/agentes`, docs/06): entram no banco com o login do papel `leitor`, que só lê. No banco local, `supabase db reset` aplica `supabase/seed.sql`, que cria esse login; num banco já criado, rode o seed uma vez. Depois use `AGENTES_DATABASE_URL=postgresql://leitor:leitor@127.0.0.1:55322/postgres`.

Sem Supabase Storage, use `RAW_STORE=local` para gravar as respostas brutas em `data/raw/`.

## Verificações

```bash
uv run pytest                          # pipelines (sem rede)
uv run pytest -m network               # endpoints oficiais, ao vivo
DATABASE_URL="$DB_URL" uv run pytest -m db   # banco recusa alterar dado; agente só lê
DATABASE_URL="$DB_URL" uv run python -m pipelines.run atrasos   # algum indicador passou do prazo?
DATABASE_URL="$DB_URL" uv run python -m pipelines.run auditar   # banco igual às respostas brutas?
pnpm --filter @brasilado/web auditar-tela http://localhost:3000   # tela igual ao banco? (site rodando)
uv run ruff check pipelines scripts
uv run python scripts/check_terms.py   # termos proibidos (docs/02)
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @brasilado/web tokens --check   # tokens CSS em dia com o DESIGN.md
```

## Produção

- **Coleta:** `.github/workflows/coleta.yml`, todo dia às 10h de Brasília (séries, eleições, notícias, agenda e mapas por estado). Segredos no ambiente `producao` do GitHub: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. O `DATABASE_URL` precisa ser a conexão direta ou o pooler em modo sessão (porta 5432): o pipeline troca para o papel `coletor` no início da sessão e recusa rodar se a troca não valer.
- **Auditoria:** `.github/workflows/auditoria.yml`, todo dia às 21h de Brasília. Falha se algum valor do banco não sair igual da resposta bruta ou se um arquivo bruto foi trocado.
- **Atrasos:** `.github/workflows/atrasos.yml`, todo dia às 20h de Brasília. Falha (e o GitHub manda e-mail) se algum indicador ou mapa passou do prazo de divulgação sem o período novo no banco.
- **Salto fora do histórico:** a coleta da série para e o erro diz o período. Confira o valor na publicação oficial; se estiver certo, registre em `config/aprovacoes.yaml` (série, período, valor, quem, quando, link) e rode a coleta de novo.
- **Integridade:** o banco só aceita INSERT em `observations`, `observacoes_uf` e nas tabelas de votos (`supabase/migrations/20261109000000_integridade.sql`). Corrigir um dado é gravar uma revisão nova.
- **Web:** variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`. As páginas são estáticas e revalidam a cada hora.
- **CI:** `.github/workflows/ci.yml` (lint, testes, termos proibidos, migrações).
