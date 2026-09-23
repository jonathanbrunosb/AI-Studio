# Segurança — AI Studio

Controles implementados e verificados na Sprint 8, com a respectiva evidência. Controles não implementados aparecem em "Pendências".

## 1. Autenticação e sessão

| Controle | Implementação | Evidência |
|---|---|---|
| Login por e-mail/senha (Supabase Auth); cadastro público desabilitado | `src/app/auth/actions.ts` | `e2e/auth.spec.ts` |
| Mensagem neutra em credenciais inválidas e na recuperação de senha | idem | `e2e/auth.spec.ts` |
| Usuário inativo bloqueado no login **e com sessão já aberta** | `requireUser` → `/auth/signout` (só atua para perfil inativo, evitando CSRF de logout) | `e2e/permissions.spec.ts` |
| Redirecionamento pós-login só para caminhos internos (anti open-redirect) | `safeInternalRedirect` | `tests/auth-validation.test.ts`, `e2e/auth.spec.ts` |
| Links de senha e redirecionamentos usam `NEXT_PUBLIC_APP_URL` (sem injeção de Host) | `appUrl`, `requestPasswordRecovery` | `tests/auth-validation.test.ts` |
| Sessão por cookies HttpOnly (Supabase SSR); Supabase indisponível = não autenticado | `src/lib/supabase/proxy.ts` | `e2e/security.spec.ts` |

## 2. Autorização

- **Papéis**: `admin`, `editor`, `approver` (`user_roles`). Páginas e as 15 Server Actions administrativas exigem `requireAdmin()`.
- **RLS em todas as tabelas públicas**, sem concessões a `anon`; funções de transição `SECURITY DEFINER` validam `auth.uid()`, papel, status e versão.
- **Segregação de funções**: quem é autor ou submeteu não decide a revisão (`SELF_APPROVAL`), inclusive administradores — verificado pela interface **e** chamando a função no banco (`e2e/journey-editorial.spec.ts`).
- **Tentativas de burla testadas** (`e2e/permissions.spec.ts`), todas bloqueadas: atribuir-se `admin`, remover papel de outro, desativar outro usuário, alterar configuração/cota de IA, criar cliente de integração, alterar destino do portal, apagar ou forjar auditoria, ler rascunho alheio, excluir imagem alheia, aprovador gerar imagem, editor gerar em conteúdo alheio.

## 3. Segurança HTTP

| Cabeçalho | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self' 'nonce-<aleatório por requisição>' 'strict-dynamic'` (sem `unsafe-inline`/`unsafe-eval` em produção); `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `connect-src`/`img-src` restritos ao próprio domínio e ao Supabase |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | câmera, microfone, geolocalização, pagamento, USB e `interest-cohort` desativados |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Powered-By` | removido |
| `Strict-Transport-Security` | **somente** com `ENABLE_HSTS=true` (produção, HTTPS validado no domínio e subdomínios) |

Exceção consciente: `style-src 'unsafe-inline'` permanece (estilos inline de React/Fabric; risco baixo sem execução de script). Evidência: `e2e/security.spec.ts` verifica nonce, ausência de violações de CSP e nonce diferente a cada requisição.

## 4. APIs

| Rota | Proteção |
|---|---|
| `/api/ai/*` | Sessão + papel editorial + dono do conteúdo; cota atômica no banco; validação de modelo/parâmetros; download apenas de hosts permitidos, com limite de tamanho e verificação de formato |
| `/api/publications/[id]/package` | Sessão + RLS + transição autorizada; verificação do SHA-256 armazenado antes de entregar |
| `/api/integrations/portal/v1/*` | Token Bearer (armazenado como SHA-256), escopos, revogação, limite de 60 req/min por cliente, `WWW-Authenticate` |
| `/api/health` | Público; retorna apenas `status`, `service` e `timestamp` (503 sem configuração) |

## 5. Dados, Storage e segredos

- Buckets privados, acesso por URL assinada de curta duração; snapshots guardam o caminho, não a URL. Correspondência com a especificação: `editor-assets` (biblioteca de mídias — "media-library"), `ai-generated` (imagens de IA), `ai-references` (referências enviadas para IA), `publication-packages` (pacotes aprovados — "published-assets", acesso somente autenticado; não há URL pública permanente).
- `SUPABASE_SERVICE_ROLE_KEY`, `FAL_KEY` e a chave de assinatura só existem no servidor (sem prefixo `NEXT_PUBLIC_`).
- Nenhuma credencial real no repositório; `.env.example` apenas com nomes. Testes usam somente dados fictícios (`*@e2e.invalid`).
- Pacotes de publicação assinados (ECDSA P-256) e verificados pelo Portal (SHA-256 + assinatura); adulteração de 1 byte é recusada (`e2e/journey-publication.spec.ts`).

## 6. Auditoria — governança e retenção

- `audit_logs` registra criação/edição de conteúdo, versões, decisões editoriais, IA, papéis e desativações; leitura somente por administradores.
- **Imutável** (migração `sprint_8_audit_governance`): `UPDATE`, `DELETE` e `TRUNCATE` bloqueados por trigger **inclusive para `service_role` e para o dono do banco**, exceto:
  - anonimização do ator (`actor_id → NULL`) quando um usuário é excluído;
  - `app_private.purge_audit_logs(antes_de, justificativa)` — somente o dono do banco executa; exige prazo mínimo de 365 dias e justificativa; registra a própria execução.
- **Prazo de retenção**: decisão de negócio/compliance, **ainda não definida**. A rotina não é agendada; nada é apagado automaticamente.
- Logs de aplicação (Railway) não contêm senhas, tokens, chaves, cookies, prompts nem e-mails (redação automática).

## 7. Dependências e cadeia de suprimentos

- Versões exatas em `package.json` + `package-lock.json`; `npm audit` sem vulnerabilidades em 23/09/2026; CI executa `npm audit --audit-level=high`.
- Binários da pilha de testes com SHA-256 fixado.
- Atualizações disponíveis não aplicadas: `next`/`eslint-config-next` 16.3.6 (patch), `eslint` 10 e `typescript` 7 (major — avaliar com calma).

## 8. Pendências

1. **Ativar "Leaked password protection"** no Supabase Auth (advisor de segurança) e revisar política de senha.
2. Plano Supabase adequado a produção (backups; ver DEPLOYMENT.md §6) e avaliação de **residência de dados** (projeto em us-east-2/EUA) frente à LGPD e às políticas corporativas.
3. Definir prazo de retenção da auditoria.
4. Limitador de taxa próprio no login (hoje depende do Supabase Auth) e limitador distribuído se houver réplicas.
5. HSTS após validação do domínio.
6. Monitor externo de disponibilidade e alertas.
7. Teste de intrusão independente antes de ampliar o uso.

## 9. Gestão de incidentes (procedimento recomendado)

| Etapa | Ação |
|---|---|
| 1. Detecção | Alertas/logs (`app.unhandled`, picos de `auth.login_failed`, `integration.request_rejected`), relato de usuário ou advisor do Supabase |
| 2. Contenção | Conforme o caso: desativar usuário em `/administracao`; revogar token de integração em `/administracao/integracoes`; desabilitar IA em `/administracao/ia`; rotacionar chave comprometida (Supabase: nova service key; fal.ai: nova `FAL_KEY`; assinatura: nova chave e atualização da chave pública no portal) e reimplantar |
| 3. Investigação | Correlacionar `X-Request-Id`/`digest` nos logs do Railway; consultar `audit_logs`, `approval_events` e `publication_events` (imutáveis/rastreáveis) |
| 4. Erradicação e recuperação | Corrigir, validar em homologação, reimplantar; restaurar dados somente conforme DEPLOYMENT.md §6 |
| 5. Comunicação | Informar responsável do projeto e, havendo dados pessoais envolvidos, a área de privacidade/encarregado (LGPD) |
| 6. Lições aprendidas | Registrar causa raiz, ações corretivas e testes de regressão |

## 10. Reporte de vulnerabilidades

Comunicar ao responsável técnico do projeto por canal interno, sem divulgar detalhes em issues públicas.
