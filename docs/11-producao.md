# Colocar em produção

Passo a passo para publicar o oBrasa e deixar a esteira rodando sozinha. Os passos estão na ordem em que precisam acontecer: o site lê o banco já na construção, então o banco precisa existir e ter dados antes do primeiro deploy.

Nenhuma senha ou chave entra no git. Cada uma vai num lugar só, indicado na tabela de segredos.

## Antes de publicar

Já feito: cabeçalhos de segurança (CSP e outros, `apps/web/src/lib/seguranca.ts`), `robots.txt`, `sitemap.xml` e a página `/privacidade`. O `robots.txt` e o `sitemap.xml` são gerados no build com o `SITE_URL` daquele momento: defina a variável na Vercel antes do primeiro deploy.

O que ainda não está feito e precisa de decisão ou trabalho antes do lançamento público:

| Item | Situação | O que falta |
|---|---|---|
| Formulário "Reportar erro" | Página existe, sem formulário | Decidir o canal (issue pública no GitHub, e-mail ou formulário com banco) e construir. Atualizar `/privacidade` com o que ele guarda |
| Domínio | Não escolhido | Registrar e apontar para a Vercel; define `SITE_URL` |
| Repositório público ou privado | Em aberto ([08](08-decisoes-em-aberto.md), D8) | Público: sem limite de minutos no Actions, código auditável. Privado: 2.000 minutos por mês no plano grátis, e só as notícias gastam boa parte |
| Proteção da `main` | Não configurada | A coleta lê o config da `main`. Exigir CI verde antes do merge impede que um config errado chegue à coleta |
| Atualização de dependências | Manual | Ativar o Dependabot para o npm, o uv e as GitHub Actions |
| Formato jurídico e financiamento | Em aberto (D2, D3) | Não bloqueia o deploy técnico; bloqueia o lançamento público. A página "Quem financia" foi retirada em 02/11/2026 e volta quando D3 for decidido |

## 1. Supabase

1. Criar o projeto (região São Paulo, `sa-east-1`). Guardar a senha do banco num gerenciador de senhas.
2. Aplicar as migrações: `supabase link --project-ref <ref>` e `supabase db push`. **Não** rodar `supabase/seed.sql` em produção: ele cria a senha local do `leitor`.
3. No painel, em SQL Editor, dar login aos papéis com senhas novas, geradas no gerenciador de senhas:
   - `alter role leitor login password '<senha nova>';` (agentes, só leitura)
4. Em Authentication, desligar "Allow new users to sign up". O site não tem login, e com o cadastro ligado qualquer pessoa cria um usuário pela API.
5. Em Storage, conferir que o bucket `raw` é privado (a primeira coleta o cria).
6. Em Advisors, rodar Security e Performance e resolver o que aparecer como erro.

## 2. GitHub

1. Em Settings → Environments, criar o ambiente `producao` e restringir a branch `main`. Todos os workflows agendados usam esse ambiente, e os segredos ficam nele.
2. Cadastrar os segredos do ambiente (tabela abaixo).
3. Em Settings → Branches, proteger a `main`: exigir os checks do CI (`ci.yml`).
4. Rodar à mão, em Actions, na ordem: Coleta → Notícias → Auditoria → Atrasos. A primeira coleta grava o histórico completo e pode levar alguns minutos.
5. Conferir que nenhuma issue "Alerta" foi aberta. Se foi, ela diz o que falhou.

## 3. Vercel (site)

1. Importar o repositório, com a pasta `apps/web` como raiz do projeto.
2. Variáveis de ambiente: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SITE_URL`. A chave anônima só lê (RLS) e o site a usa no servidor.
3. Fazer o deploy **depois** da primeira coleta: a construção lê os indicadores do banco.
4. Abrir `https://<domínio>/saude`: precisa responder 200, com todos os jobs no prazo.

## 4. Cloudflare R2 (cópia de segurança)

O R2 é um armazenamento de arquivos da Cloudflare, compatível com a API S3 da Amazon. O plano grátis guarda até 10 GB sem cobrar a saída dos dados. O workflow `backup.yml` grava ali, toda semana, o dump do banco e as respostas brutas novas, e testa o restauro.

1. Criar uma conta em <https://dash.cloudflare.com/sign-up>. Não é preciso ter domínio na Cloudflare.
2. No menu lateral, abrir **R2 Object Storage**. Na primeira vez, a Cloudflare pede um cartão para ativar o R2, mesmo no plano grátis. Nada é cobrado dentro de 10 GB e 1 milhão de gravações por mês; a cópia semanal do oBrasa fica bem abaixo disso.
3. **Create bucket**: nome `obrasa-backup`, localização automática. Deixar o acesso público desligado.
4. Na página do R2, em **Account details**, copiar o **Account ID**.
5. Em **Manage API tokens** → **Create Account API token**:
   - permissão **Object Read & Write**;
   - **Apply to specific buckets only**: `obrasa-backup`;
   - sem data de expiração, ou com lembrete para renovar.
6. A Cloudflare mostra o **Access Key ID** e o **Secret Access Key** uma vez só. Copiar os dois direto para os segredos do GitHub (tabela abaixo), sem colar em chat, e-mail ou arquivo.
7. Em Actions, rodar **Cópia de segurança** à mão. O último passo restaura a cópia num banco vazio e confere; se passar, o backup está funcionando.

Restaurar de verdade, se um dia for preciso: baixar o dump mais recente (`BACKUP_DESTINO=r2 uv run python -m pipelines.backup baixar-ultimo banco.dump manifesto.json`), criar um projeto novo, aplicar as migrações e rodar `pg_restore --data-only` no banco novo. As respostas brutas ficam em `brutos/` no bucket, com o mesmo caminho que tinham no Storage.

## 5. UptimeRobot (vigia de fora do GitHub)

O UptimeRobot acessa um endereço de tempos em tempos e manda um e-mail quando ele para de responder 200. Aqui ele acessa `/saude`, que responde 503 quando um job passou do prazo sem rodar ou quando as notícias pararam de entrar. É a peça que avisa se o próprio GitHub parar de rodar a esteira.

1. Criar uma conta grátis em <https://uptimerobot.com>.
2. **New monitor**:
   - tipo **HTTP(s)**;
   - nome `oBrasa — esteira`;
   - URL `https://<domínio>/saude`;
   - intervalo de 5 minutos (o mínimo do plano grátis).
3. Em **Alert contacts**, deixar o seu e-mail marcado.
4. Salvar. Em poucos minutos o monitor aparece como **Up**.
5. Opcional: um segundo monitor para a página inicial (`https://<domínio>/`), para saber se o site saiu do ar.

O que fazer quando chegar o e-mail "Down": abrir `/saude` no navegador. O JSON diz qual job está fora do prazo e quando rodou pela última vez. Em seguida, olhar em Actions se o workflow desse job está rodando. Se o GitHub desligou o agendamento, há um botão para religar.

## Segredos

| Segredo | Onde fica | Para quê |
|---|---|---|
| `DATABASE_URL` | GitHub, ambiente `producao` | Coleta, auditoria, atrasos, backup (conexão direta, porta 5432) |
| `SUPABASE_URL` | GitHub `producao` e Vercel | Storage (coleta) e leitura (site) |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub `producao` | Gravar e ler as respostas brutas no Storage. Nunca na Vercel |
| `SUPABASE_ANON_KEY` | Vercel | Leitura pública do site |
| `AGENTES_DATABASE_URL` | GitHub `producao` | Agentes, com o login do `leitor` (fase 4, docs/06) |
| `ANTHROPIC_API_KEY` | GitHub `producao` | Agentes (fase 4). Definir limite de gasto mensal no console da Anthropic |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | GitHub `producao` | Cópia de segurança |
| `SITE_URL` | Vercel | Links das imagens de compartilhamento |
