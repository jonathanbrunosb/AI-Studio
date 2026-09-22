# AI Studio — Comunicação Contábil

Aplicação corporativa para criação, gestão e futura aprovação de comunicados, newsletters e materiais visuais da Gerência de Contabilidade.

## Stack

- Next.js 16 com App Router, Server Actions e `proxy.ts`.
- React 19, TypeScript e Tailwind CSS 4.
- Supabase Auth, PostgreSQL e Data API com SSR por cookies.
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
npm run test
npm run typecheck
npm run lint
npm run build
```

O teste de integração usa somente a chave publicável e verifica que consultas anônimas são negadas e credenciais inválidas não criam sessão. As asserções estruturais de banco estão em `supabase/tests/database_security.sql` e podem ser executadas com o ambiente local do Supabase.

Testes completos de login válido, logout, convite e ciclo persistente exigem uma conta de teste convidada e `SUPABASE_SERVICE_ROLE_KEY` configurada no ambiente seguro; credenciais de teste não devem ser versionadas.

## Railway

- Build command: `npm run build`
- Start command: `npm run start`
- Node.js: versão 22 ou superior.
- Cadastre no Railway todas as variáveis listadas em `.env.example`.
- Use uma chave estável em `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` para manter Server Actions consistentes entre réplicas e deploys.
- Nunca exponha a chave administrativa como variável pública.

## Limites desta sprint

O bucket de mídia, geração de imagens, editor visual completo e transições de aprovação permanecem desativados. As tabelas preparatórias existem, mas não concedem operações de escrita aos clientes nesta etapa.
