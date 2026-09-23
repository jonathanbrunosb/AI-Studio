# Implantação, ambientes, backup e rollback

> **Estado em 23/09/2026:** nenhum serviço do AI Studio foi criado no Railway. Esta documentação prepara a implantação;
> a execução em produção depende de aprovação explícita do responsável.

## 1. Estratégia de ambientes

| Ambiente | Aplicação | Banco/Auth/Storage | Finalidade | Dados |
|---|---|---|---|---|
| Desenvolvimento | `npm run dev` local | Pilha E2E local (`scripts/e2e`) ou projeto Supabase de desenvolvimento | Construção e testes | Fictícios |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | PostgreSQL de serviço + pilha E2E | Qualidade automatizada a cada PR | Fictícios, descartáveis |
| Homologação | Railway, ambiente `homologacao` | **Projeto Supabase separado** (recomendado) | Roteiro `docs/HOMOLOGACAO.md` com usuários-chave | Fictícios ou anonimizados |
| Produção | Railway, ambiente `production` | Projeto `idrseyhwkhlvedfgzecb` (após adequação — ver §6) | Uso corporativo | Reais |

Regras:

- Homologação **não** compartilha banco com produção. Hoje existe um único projeto Supabase; criar o projeto de homologação é pré-requisito.
- Migrações seguem sempre a ordem CI → homologação → produção, pelo mesmo arquivo versionado em `supabase/migrations`.
- Chaves (`SUPABASE_SERVICE_ROLE_KEY`, `FAL_KEY`, `PORTAL_SIGNING_PRIVATE_KEY`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`) são **distintas por ambiente**.
- `E2E_MODE` e `E2E_FAL_BASE_URL` nunca são definidas no Railway (a aplicação as ignora quando detecta variáveis do Railway).

## 2. Variáveis de ambiente

| Variável | Obrigatória | Escopo | Observação |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | Público | URL do projeto Supabase do ambiente |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim | Público | Chave publicável (RLS se aplica) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | **Secreto** | Ignora RLS; usada somente no servidor após autorização |
| `NEXT_PUBLIC_APP_URL` | Sim | Público | URL HTTPS pública, sem barra final; base de redirecionamentos e links de senha |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Sim (prod) | **Secreto** | `openssl rand -base64 32`; estável entre deploys e réplicas |
| `ENABLE_HSTS` | Não | Config | `true` somente em produção com HTTPS validado (ver SECURITY.md) |
| `AI_IMAGE_PROVIDER` | Não | Config | `fal` |
| `FAL_KEY` | Não | **Secreto** | Sem ela a IA fica indisponível (interface informa) |
| `PORTAL_SIGNING_PRIVATE_KEY` | Não | **Secreto** | ECDSA P-256 PKCS#8 com `\n`; sem ela os pacotes saem sem assinatura |

Na inicialização a aplicação registra `config.invalid` (nomes das variáveis ausentes, nunca valores) e `config.feature_disabled` para recursos opcionais desligados.

## 3. Railway — configuração

`railway.json` (Config as Code):

- Build: Railpack, `npm run build` (Node ≥ 22, conforme `engines`).
- Start: `npm run start` (o Next.js usa a variável `PORT` do Railway).
- Healthcheck: `GET /api/health` (sem autenticação, sem dados internos), timeout 60 s.
- Reinício: `ON_FAILURE`, até 5 tentativas; `drainingSeconds` 15.

> **Atenção:** o Railway declarou o Config as Code (`railway.json`) **descontinuado**, com suporte para serviços existentes até **01/12/2026**, recomendando migrar para Infrastructure as Code (`.railway/railway.ts`). Migrar antes dessa data (pendência registrada).

### Passo a passo (primeira implantação — requer aprovação)

1. Criar projeto `ai-studio` no Railway com os ambientes `homologacao` e `production`; conectar o repositório `jonathanbrunosb/AI-Studio`, branch `main`.
2. Cadastrar as variáveis da §2 em cada ambiente (valores próprios de cada ambiente).
3. Gerar domínio (Railway ou domínio corporativo). Atualizar `NEXT_PUBLIC_APP_URL`.
4. No Supabase do ambiente: **Authentication → URL Configuration** — Site URL = `NEXT_PUBLIC_APP_URL`; Redirect URLs = `<APP_URL>/auth/callback**` (o link de redefinição usa `/auth/callback?next=/atualizar-senha`).
5. Aplicar as migrações pendentes no Supabase do ambiente (em ordem; conferir com `list_migrations`).
6. Deploy. Aguardar healthcheck verde.
7. Executar as verificações pós-implantação (§4).
8. Somente após validar HTTPS no domínio e subdomínios: `ENABLE_HSTS=true` e novo deploy.

## 4. Verificações pós-implantação

| # | Verificação | Como | Esperado |
|---|---|---|---|
| 1 | Saúde | `curl -i <APP_URL>/api/health` | 200, `{"status":"ok"}` |
| 2 | Cabeçalhos | `curl -sI <APP_URL>/login` | CSP com `nonce-`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, sem `X-Powered-By` |
| 3 | Proteção de rotas | abrir `<APP_URL>/dashboard` sem sessão | redireciona para `/login?redirect=` |
| 4 | Login e papéis | um usuário de cada papel | acesso conforme papel |
| 5 | Configuração | logs do Railway | ausência de `config.invalid` |
| 6 | IA (se habilitada) | uma geração real autorizada | job `completed` e imagem no Storage (custo ≈ US$ 0,003 no modelo mais barato) |
| 7 | Recuperação de senha | solicitar para usuário de teste | e-mail com link para `<APP_URL>` |
| 8 | Advisors Supabase | painel ou MCP | somente os avisos intencionais documentados |

## 5. Monitoramento

- **Logs estruturados** (JSON por linha, stdout → Railway Logs). Campos: `ts`, `level`, `event`, `service`, `requestId` quando aplicável. Chaves que parecem sensíveis (senha, token, chave, cookie, prompt, e-mail) são substituídas por `[redacted]`.
- **Correlação**: todo response carrega `X-Request-Id` (gerado ou propagado); erros não tratados (`app.unhandled`) registram o mesmo id e o `digest` exibido ao usuário.
- **Eventos a monitorar**:

| Evento | Nível | Ação sugerida |
|---|---|---|
| `app.unhandled` | error | Investigar pelo `requestId`/`digest` |
| `config.invalid` | error | Corrigir variáveis e reimplantar |
| `ai.finalize_failed`, `ai.generation_failed` | error | Verificar fal.ai/Storage; o acompanhamento tenta novamente |
| `ai.provider_transient` | warn | Alertar se persistir > 10 min |
| `auth.login_failed` | warn | Alertar em picos (possível ataque de senha) |
| `integration.request_rejected` | warn | Tokens inválidos/revogados do Portal |
| `storage.failed`, `publication.failed`, `editorial.operation_failed` | warn/error | Verificar pelo código registrado |

- **Disponibilidade**: healthcheck do Railway + monitor externo (ex.: UptimeRobot) em `/api/health` a cada 5 min — **não configurado**.
- **Alertas**: o Railway não envia alertas por padrão; configurar notificações de falha de deploy e um dreno de logs se houver ferramenta corporativa — **pendente**.

## 6. Backup e recuperação

### Situação real verificada (23/09/2026)

- Organização Supabase **`Estudio-EQTL` no plano Free**; projeto em **us-east-2 (EUA)**.
- Segundo a documentação do Supabase, **backups diários automáticos existem apenas nos planos Pro, Team e Enterprise**; para o Free a recomendação é exportar regularmente com `supabase db dump` e manter cópia externa.
- **Projetos Free são pausados após 7 dias de baixa atividade.**
- **Backups do banco não incluem arquivos do Storage** (imagens, pacotes) em nenhum plano.

**Conclusão:** a infraestrutura atual **não atende a requisitos de produção** para continuidade e recuperação.

### Recomendação (decisão do responsável)

| Opção | Custo mensal (ref. documentação Supabase) | RPO | Observação |
|---|---|---|---|
| Plano Pro | a partir de US$ 25 | 24 h (backup diário, 7 dias) | Remove a pausa por inatividade — **mínimo recomendado** |
| Pro + PITR 7 dias | ≈ US$ 25 + compute Small + ~US$ 100 | ≈ 2 min | Indicado se a perda de 1 dia de trabalho for inaceitável |
| Manter Free + dump manual | 0 | depende da disciplina | **Não recomendado para produção** |

Independentemente do plano:

1. **Dump lógico semanal** (e antes de cada migração): `supabase db dump --db-url "$DB_URL" -f backup_$(date +%F).sql` e `--data-only` em arquivo separado, guardados em repositório corporativo com acesso restrito.
2. **Storage**: cópia periódica dos buckets `ai-generated`, `editor-assets` e `publication-packages` (API S3 compatível do Supabase) — os pacotes publicados são a evidência do que foi divulgado.
3. **Teste de restauração** trimestral **em projeto separado** (nunca sobre produção sem autorização explícita): restaurar o dump, apontar uma instância de homologação e executar os passos 1–5 do roteiro de homologação.
4. Metas sugeridas (a validar com o negócio): RPO 24 h / RTO 4 h no plano Pro.

### Procedimento de recuperação (resumo)

1. Declarar incidente e congelar deploys.
2. Criar projeto Supabase novo (ou usar backup do painel, no plano Pro).
3. Restaurar o dump (`psql -f`), reaplicar `supabase/migrations` pendentes, restaurar Storage.
4. Atualizar variáveis do Railway para o projeto restaurado e reimplantar.
5. Validar com as verificações da §4 e comunicar os usuários.

## 7. Rollback

| Situação | Ação | Tempo estimado |
|---|---|---|
| Deploy com defeito na aplicação | Railway → Deployments → deploy anterior → **Redeploy** (ou `git revert` + push) | minutos |
| Variável incorreta | Corrigir no Railway e reimplantar | minutos |
| Migração com defeito | **Não há "down migration" automática.** Aplicar migração corretiva nova (forward fix). As migrações da Sprint 8 são aditivas e idempotentes | 30–60 min |
| Migração destrutiva (não existe hoje) | Exige dump prévio obrigatório e janela aprovada | — |
| Dados corrompidos | Recuperação (§6), em projeto separado primeiro | horas |

Regra: toda migração nova precisa ser **compatível com a versão anterior da aplicação** (adicionar antes de remover), para que o rollback da aplicação não quebre o banco.

### Rollback específico da Sprint 8

- Aplicação: redeploy do commit anterior ao merge da Sprint 8.
- Banco: `sprint_8_hardening` e `sprint_8_audit_governance` **não devem ser revertidas** — corrigem defeitos que impedem criar conteúdo, enviar para aprovação e concluir gerações de IA, e protegem a trilha de auditoria. A aplicação anterior continua compatível com elas (apenas adicionam função, índices e políticas equivalentes/mais restritivas).
