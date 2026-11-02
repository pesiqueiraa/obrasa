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

Sem Supabase Storage, use `RAW_STORE=local` para gravar as respostas brutas em `data/raw/`.

## Verificações

```bash
uv run pytest                          # pipelines (sem rede)
uv run pytest -m network               # endpoints oficiais, ao vivo
uv run ruff check pipelines scripts
uv run python scripts/check_terms.py   # termos proibidos (docs/02)
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @brasilado/web tokens --check   # tokens CSS em dia com o DESIGN.md
```

## Produção

- **Coleta:** `.github/workflows/coleta.yml`, todo dia às 10h de Brasília. Segredos no ambiente `producao` do GitHub: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Web:** variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`. As páginas são estáticas e revalidam a cada hora.
- **CI:** `.github/workflows/ci.yml` (lint, testes, termos proibidos, migrações).
