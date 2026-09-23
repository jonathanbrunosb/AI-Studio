# Arquitetura — AI Studio · Comunicação Contábil

Documento de referência técnica (Sprint 8). Descreve o que está implementado no repositório; itens não implementados estão marcados como tal.

## 1. Visão geral

```
Navegador (React 19 / Fabric.js 7)
   │  HTTPS · cookies de sessão (Supabase SSR) · CSP com nonce por requisição
   ▼
Next.js 16 (Railway, 1 serviço Node)
   ├─ proxy.ts ............ sessão, redirecionamentos, CSP/nonce, X-Request-Id
   ├─ Server Components .... leitura com o cliente do usuário (RLS)
   ├─ Server Actions ....... escrita com o cliente do usuário (RLS + RPCs)
   ├─ Route Handlers ....... IA, download de pacotes, API do Portal, health
   └─ instrumentation.ts ... logs JSON, verificação de configuração
   │
   ├──► Supabase (projeto idrseyhwkhlvedfgzecb · us-east-2 · plano Free)
   │      Auth (GoTrue) · PostgreSQL 17 com RLS · Storage privado · PostgREST
   ├──► fal.ai Queue API (geração de imagens; somente servidor)
   └──◄ Portal da Contabilidade (importação de pacote ZIP assinado; API opcional com token)
```

## 2. Camadas e responsabilidades

| Camada | Local | Responsabilidade |
|---|---|---|
| Rotas protegidas | `src/app/(protected)/*` | Dashboard, Estúdio, Editor, Biblioteca, Gestão Editorial, Publicações, Modelos, Administração |
| Autenticação | `src/app/(auth)/*`, `src/app/auth/*` | Login, recuperação/atualização de senha, callback, encerramento de sessão de usuário inativo |
| Autorização | `src/lib/auth/authorization.ts` | `requireUser`, `requireAdmin`; perfil inativo = sem acesso |
| Regras editoriais | `src/lib/editorial/workflow-rules.ts` | Espelho das regras do banco para a interface (a regra efetiva está no banco) |
| Editor visual | `src/hooks/use-editor*.ts`, `src/lib/editor/*` | Fabric.js, serialização, salvamento automático, exportação |
| IA | `src/lib/ai/*`, `src/app/api/ai/*` | Provedor fal.ai, cota atômica, validação de modelo, download e armazenamento do resultado |
| Publicações | `src/lib/publications/*`, `src/app/(protected)/publicacoes` | Pacote ZIP (manifesto, imagem PNG, SHA-256, assinatura ECDSA P-256) |
| API do Portal | `src/app/api/integrations/portal/v1/*` | Listagem, ativos e confirmação por token com escopo e limite de taxa |
| Segurança HTTP | `src/proxy.ts`, `src/lib/security/headers.ts`, `next.config.ts` | CSP, cabeçalhos defensivos, HSTS condicionado |
| Observabilidade | `src/lib/observability/logger.ts`, `src/instrumentation.ts` | Logs JSON por linha, correlação, redação de dados sensíveis |

## 3. Modelo de dados (PostgreSQL)

Migrações versionadas em `supabase/migrations` (15 arquivos com nomes iguais às versões registradas no Supabase, incluindo 5 marcadores de histórico vazios; aplicados em ordem). Principais entidades:

- `profiles`, `user_roles` (papéis: `admin`, `editor`, `approver`).
- `contents` (status: `draft` → `in_review` → `changes_requested`/`approved` → `published`; `archived`), `content_versions` (`working`, `checkpoint`, `review`, versões aprovadas imutáveis), `approval_events`.
- `media_assets`, `generation_jobs`, `ai_settings`, `ai_models`, `ai_user_limits`.
- `publication_exports`, `publication_events`, `portal_destinations`, `content_category_destinations`, `integration_clients`, `portal_integration_settings`.
- `audit_logs` (imutável — ver SECURITY.md), `notifications`, `templates`, `brand_settings`.

Princípios:

1. **O banco é a fonte da regra.** Transições editoriais e de publicação são funções `SECURITY DEFINER` que validam `auth.uid()`, papel, status e versão (`submit_content_for_review`, `decide_content_review`, `create_new_content_version`, `archive_content`, `transition_publication`). A interface apenas espelha essas regras.
2. **RLS em todas as tabelas públicas**, sem concessões a `anon`. Escritas privilegiadas (`service_role`) acontecem só no servidor, após autorização explícita.
3. **Segregação de funções no banco**: o autor ou quem submeteu não decide (`SELF_APPROVAL`), mesmo com papel de administrador.
4. **Versões aprovadas imutáveis**: trigger de proteção de escrita; a edição cria nova versão de trabalho.

## 4. Fluxos principais

- **Criação e edição**: formulário editorial → `contents` (RLS) → editor visual (Fabric) → salvamento automático a cada alteração (1,8 s) na versão `working`; "Salvar versão" cria `checkpoint`.
- **Aprovação**: envio cria versão `review` imutável → aprovador (diferente do autor) aprova ou devolve com justificativa obrigatória → nova rodada gera novo ciclo.
- **IA**: `POST /api/ai/generations` (reserva de cota atômica) → fal.ai Queue → acompanhamento por polling → `claim_generation_finalize` (RPC atômica) → download com validação de host/tamanho/formato → Storage privado `ai-generated` → `media_assets`.
- **Publicação**: pacote gerado no navegador (render PNG da versão aprovada) + validação e assinatura no servidor → Storage `publication-packages` → download registra "exportado" → importação no Portal (verifica SHA-256 e assinatura) → confirmação pelo administrador (ou pela API do Portal) → `published`. Nova versão de conteúdo publicado não remove a publicação anterior até a nova ser confirmada.

## 5. Decisões e limitações conhecidas

- **Instância única**: o limitador de taxa da API do Portal é em memória. Com réplicas, mover para banco/Redis.
- **Login**: a limitação de tentativas depende dos limites do Supabase Auth (não há limitador próprio na aplicação).
- **Renderização**: todas as páginas são dinâmicas (`connection()` no layout) para que o nonce da CSP seja aplicado; não há cache de página.
- **`notFound()` com streaming** responde HTTP 200 com a página "não encontrada" (sem dados); não afeta segurança.
- **Editor visual** é otimizado para telas ≥ 1024 px; abaixo de 768 px exibe aviso.
- **Fabric 7**: a origem padrão dos objetos foi fixada em canto superior esquerdo (`src/lib/editor/fabric-setup.ts`).

## 6. Testes

| Nível | Ferramenta | Escopo |
|---|---|---|
| Unitário | Vitest (`tests/`) | Regras, validações, IA (provedor, custo, cota), pacote, API do Portal, configuração |
| Banco | `scripts/run-sql-tests.sh` + `supabase/tests/*.sql` | RLS, grants, funções, triggers, segregação, publicação, auditoria |
| E2E | Playwright (`e2e/`) + pilha local (`scripts/e2e/`) | Jornadas completas com Auth/RLS reais, IA simulada, validação do pacote pelo módulo do Portal, permissões, responsividade, desempenho |

A pilha E2E usa PostgreSQL local, GoTrue e PostgREST (binários oficiais com SHA-256 fixado), um gateway compatível com as rotas do Supabase (Storage em memória) e um simulador da Queue API da fal.ai. **O simulador não comprova a integração real com a fal.ai.**
