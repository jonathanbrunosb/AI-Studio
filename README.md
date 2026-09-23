# AI Studio — Comunicação Contábil

Aplicação corporativa para criação, aprovação e publicação de comunicados, newsletters e materiais visuais da Gerência de Contabilidade.

## Documentação

| Documento | Conteúdo |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitetura, modelo de dados, fluxos e limitações |
| [SECURITY.md](SECURITY.md) | Controles de segurança, auditoria, pendências |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Ambientes, Railway, variáveis, monitoramento, backup, rollback |
| [docs/MANUAL_USUARIO.md](docs/MANUAL_USUARIO.md) | Manual do usuário com telas reais |
| [docs/HOMOLOGACAO.md](docs/HOMOLOGACAO.md) | Roteiro de homologação (15 passos) |
| [docs/RELATORIO_SPRINT_8.md](docs/RELATORIO_SPRINT_8.md) | Relatório executivo da Sprint 8 e prontidão |

O diagnóstico de prontidão, os gates de homologação e o roteiro de implantação estão em [`AI_STUDIO_PLANO_ENTRADA_OPERACAO.md`](AI_STUDIO_PLANO_ENTRADA_OPERACAO.md).

## Stack

- Next.js 16 com App Router, Server Actions e `proxy.ts`.
- React 19, TypeScript e Tailwind CSS 4.
- Supabase Auth, PostgreSQL, Storage privado e Data API com SSR por cookies.
- Fabric.js 7.4 para composição e exportação do editor visual.
- Vitest para testes unitários e de integração.
- Preparado para hospedagem no Railway.

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env.local` e preencha:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<chave-estável-para-railway>
   ```

   `SUPABASE_SERVICE_ROLE_KEY` é utilizada somente pelo cliente administrativo server-only para enviar convites. Nunca use prefixo `NEXT_PUBLIC_` nessa variável e nunca a versione.

3. Execute:

   ```bash
   npm run dev
   ```

4. Acesse `http://localhost:3000/login`.

## Supabase

O esquema versionado está em `supabase/migrations`. Ele cria:

- `profiles` e `user_roles`;
- `contents`;
- `templates`, `content_versions` e `media_assets`;
- `generation_jobs`, `approval_events` e `publication_exports`;
- `audit_logs`;
- funções internas, triggers, índices, grants explícitos e políticas RLS.

Todas as tabelas da aplicação usam RLS. A role `anon` não recebe acesso e a role `authenticated` recebe somente os grants necessários. Alterações de proprietário e status editorial são bloqueadas no banco, independentemente do frontend.

### Aplicar as migrações em outro projeto

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Não faça alterações estruturais apenas pelo Table Editor. Toda evolução do esquema deve gerar uma nova migração.

### Primeiro administrador

Não existe cadastro público. Para inicializar um ambiente novo:

1. Convide o primeiro usuário em **Authentication → Users** no Dashboard do Supabase.
2. Confirme que o trigger criou o registro correspondente em `public.profiles`.
3. No SQL Editor, atribua o primeiro papel administrativo usando o UUID real do usuário:

   ```sql
   insert into public.user_roles (user_id, role)
   values ('<uuid-do-primeiro-usuario>', 'admin');
   ```

Esse bootstrap funciona apenas pela conexão privilegiada do projeto. Depois disso, novos convites e permissões devem ser gerenciados pela tela `/administracao`.

### URLs de autenticação

Em **Authentication → URL Configuration**, configure:

- Site URL local: `http://localhost:3000`
- Redirect URL local: `http://localhost:3000/auth/callback`
- Site URL de produção: domínio HTTPS atribuído pelo Railway.
- Redirect URL de produção: `https://<dominio>/auth/callback`

Os fluxos de convite e recuperação dependem dessas URLs autorizadas.

## Segurança implementada

- Sessões armazenadas em cookies por `@supabase/ssr`.
- Renovação de token em `src/proxy.ts` usando `getClaims()`.
- Validação autoritativa da sessão com `getUser()` no servidor.
- Proteção de rotas no Proxy e no layout protegido.
- RLS com verificação de usuário ativo e papéis `admin`, `editor` e `approver`.
- Usuários não podem atribuir papéis a si mesmos.
- Proteção do único administrador ativo contra autorrevogação ou autodesativação.
- `created_by` e `status` dos conteúdos protegidos por trigger.
- Conteúdos aprovados, publicados ou arquivados não podem ser editados pelo fluxo comum.
- Auditoria confiável por triggers para conteúdos, permissões e status de usuários.
- Cliente administrativo isolado com `server-only`.
- Retornos de autenticação não revelam se um e-mail está cadastrado.

## Testes e validação

```bash
npm run lint && npm run typecheck && npm test   # estático + unitários (Vitest)
npm run test:sql                                # migrações + supabase/tests/*.sql em PostgreSQL descartável (PG_ADMIN_URL)
bash scripts/e2e/start-stack.sh                 # pilha local: PostgreSQL + GoTrue + PostgREST + gateway + simulador fal.ai
bash scripts/e2e/start-app.sh                   # build de produção em http://127.0.0.1:3100
npm run test:e2e                                # Playwright (jornadas, permissões, responsividade, desempenho)
bash scripts/e2e/stop-stack.sh
```

- A pilha E2E usa apenas dados fictícios (`*@e2e.invalid`) e um banco descartável; nunca aponte `PG_ADMIN_URL` para bancos reais.
- A jornada de publicação valida o ZIP com o módulo do portal (`PORTAL_REPO`, padrão `../portal-contabilidade`).
- A geração com IA nos testes usa um **simulador** da Queue API da fal.ai; isso não comprova a integração real.
- CI: `.github/workflows/ci.yml` (qualidade, SQL e E2E).

## Railway

O `railway.json` legado documenta build/start/healthcheck, mas novos serviços devem ser configurados no Railway e migrados para Infrastructure as Code (`.railway/railway.ts`) após o projeto ser criado. Passo a passo, variáveis, verificações pós-deploy e rollback em [DEPLOYMENT.md](DEPLOYMENT.md).

O workflow `.github/workflows/ci.yml` executa lint, typecheck, testes unitários, auditoria de dependências, build, testes SQL e E2E em pushes e pull requests. A existência desses arquivos não cria nem publica um serviço Railway; o primeiro deploy continua dependendo de autorização e configuração explícitas.

### Histórico de migrações

Os nomes dos arquivos em `supabase/migrations` espelham as versões registradas no projeto `AI-Studio`. As três migrações intermediárias da primeira tentativa da Sprint 5 são marcadores vazios: foram aplicadas diretamente, revertidas pela versão `20260923001244` e substituídas pelo esquema definitivo `20260923001321`. Os dois marcadores finais representam o bootstrap específico do primeiro administrador sem versionar identificadores ou dados pessoais. Essa sequência mantém `supabase migration list` alinhado e permite reproduzir o estado final em projetos novos.

## Editor visual — Sprint 4

- O Estúdio abre conteúdos editáveis em um canvas Fabric com texto, imagens, formas, camadas, agrupamento, bloqueio, ordenação e propriedades.
- Formatos lógicos: Full HD 1920 × 1080, quadrado 1080 × 1080 e vertical 1080 × 1350. O zoom responsivo não altera a resolução final.
- O projeto editável é salvo como JSON validado em `content_versions`. Há uma versão de trabalho, checkpoints imutáveis, desfazer/refazer em memória, salvamento automático e recuperação de versões.
- Imagens PNG, JPG e WebP de até 10 MiB usam o bucket privado `editor-assets` e URLs assinadas. Não há bucket público para materiais em elaboração.
- PNG e JPG são exportados na resolução lógica, identificados como rascunho. A exportação não altera o status editorial.
- A documentação de arquitetura, segurança, atalhos e limites está em [`docs/EDITOR_VISUAL.md`](docs/EDITOR_VISUAL.md).

### Migrações da Sprint 4

As migrações adicionam tipos de versão (`working`, `checkpoint`, `frozen`), uma única versão de trabalho por conteúdo, validação autoritativa do snapshot, grants por coluna, auditoria e políticas do Storage. Aplique-as pelo mesmo fluxo versionado descrito acima.

## Geração de imagens com IA — Sprint 5

- Provedor inicial: **fal.ai** (Queue API oficial), modelos FLUX.1 [schnell], FLUX.1 [dev] e FLUX.1 [dev] image-to-image.
- Painel "Geração com IA" na lateral direita do editor visual; resultados vão para o bucket privado `ai-generated` e para `media_assets`.
- Administração em `/administracao/ia`: habilitação de modelos, custos de referência, limites por usuário e indicadores de consumo.
- Variáveis obrigatórias no servidor: `FAL_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. Sem elas, o painel informa que a integração está indisponível e nenhuma geração é simulada.
- Documentação técnica e pendências: [`docs/IA_GERACAO_IMAGENS.md`](docs/IA_GERACAO_IMAGENS.md).

## Fluxo editorial — Sprint 6

- Envio para aprovação com versão imutável, fila de aprovação, tela de revisão, aprovação/ajustes, nova versão, arquivamento, histórico, notificações internas e pendências no dashboard.
- Todas as transições ocorrem em funções transacionais do PostgreSQL; ninguém aprova conteúdo próprio, nem administradores.
- Documentação: [`docs/FLUXO_EDITORIAL.md`](docs/FLUXO_EDITORIAL.md).

## Central de Publicações — Sprint 7

- `/publicacoes`: conteúdos com versão aprovada, preparação do pacote ZIP (manifesto versionado, SHA-256 e assinatura ECDSA), download autenticado, confirmação manual de publicação, falhas e nova tentativa, histórico e substituição de versões publicadas.
- `/administracao/integracoes`: destinos do portal por categoria, modo de publicação, credenciais da API (token exibido uma vez; só o hash é armazenado) e histórico de falhas.
- API autenticada `/api/integrations/portal/v1/...` pronta, **desabilitada por padrão**: o portal atual (GitHub Pages) não tem backend seguro para guardar o token.
- Importação no portal: repositório `portal-contabilidade`, Administração → "Importar do AI Studio".
- Documentação: [`docs/INTEGRACAO_PORTAL.md`](docs/INTEGRACAO_PORTAL.md).

## Sprint 8 — Testes integrados, segurança e preparação para implantação

- Testes E2E (Playwright) com Auth/RLS reais; testes SQL executáveis localmente e no CI.
- Defeitos críticos corrigidos (criação de conteúdo, envio para aprovação, conclusão de gerações de IA, posicionamento no editor com Fabric 7, entre outros) — lista completa no relatório.
- CSP com nonce, cabeçalhos defensivos, HSTS condicionado, logs estruturados com correlação, verificação de configuração, trilha de auditoria imutável.

## Limites atuais

Geração de vídeos permanece desativada. A integração real com a fal.ai e a importação do pacote no portal publicado ainda precisam ser comprovadas na homologação (passos 6 e 13 do roteiro).

## Sprint 3 — Conteúdo e modelos

- O botão Criar conteúdo abre quatro categorias. Cada categoria oferece campos próprios; a divulgação de sistemas exige solução e funcionalidade.
- A seleção de categoria carrega o modelo corporativo correspondente. Em Modelos, é possível consultar a composição e iniciar uma peça pelo template.
- Os quatro templates são dados institucionais versionados na migração, não conteúdos fictícios de usuários.
- Cada material guarda `template_id`, `editorial_details`, `layout_snapshot` e `collection_name`. As dimensões, alinhamento e visibilidade de imagem/rodapé podem ser personalizados sem alterar o template.
- Duplicar cria um rascunho independente, de autoria do usuário atual, copiando os campos, a coleção e o layout. A função SQL usa SECURITY INVOKER e respeita a visibilidade do registro de origem.
- A Biblioteca oferece busca por título, categoria, status, coleção, filtro de autoria, ordenação e paginação de 12 itens.
- Materiais consultáveis, mas não editáveis pelo usuário, são abertos em modo de leitura.
- Administradores configuram cores, fonte, nome institucional, logotipo e assinatura em `/administracao/identidade`, acessível pela página Modelos. A identidade central vale para todas as prévias; a composição individual permanece independente.
- Imagem de apoio e logotipo da configuração editorial continuam aceitando URL HTTP(S); o editor visual utiliza o Storage privado para mídias da composição.
- A prévia editorial da Sprint 3 permanece responsiva; a exportação pixel a pixel é realizada somente pelo editor visual da Sprint 4.

### Verificação da Sprint 3

Os cenários de `supabase/tests/sprint_3_editorial.sql` são executados por `npm run test:sql` (e no CI). Na Sprint 8 esse roteiro revelou que a política de leitura de `contents` impedia a criação de conteúdo; a correção está na migração `sprint_8_hardening`.
