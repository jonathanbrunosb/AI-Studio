# AI Studio — Plano de Entrada em Operação

**Data da auditoria:** 22/09/2026
**Repositório avaliado:** `jonathanbrunosb/AI-Studio`, branch `main`, commit-base `47cb784`
**Supabase avaliado:** projeto `AI-Studio` (`idrseyhwkhlvedfgzecb`)
**Conclusão:** **não liberar em produção ainda**. O produto possui uma base funcional ampla e build reproduzível, mas ainda depende de implantação, credenciais seguras, homologação autenticada ponta a ponta e tratamento dos alertas de segurança descritos neste documento.

## 1. Critérios de classificação

| Status | Significado usado nesta auditoria |
|---|---|
| ✅ Validado | Implementado e testado com sucesso no ambiente disponível. |
| 🟡 Pendente de configuração | Implementado, mas depende de credencial, serviço, conta ou configuração externa. |
| 🟠 Implementação incompleta | Parcialmente desenvolvido, sem cobertura suficiente ou com falha técnica identificada. |
| 🔴 Não implementado | Entrega prevista sem implementação encontrada. |
| ⚪ Não verificável | As evidências disponíveis não permitem confirmar o comportamento. |

Código existente, interface renderizada e migração aplicada são evidências diferentes. Uma integração só é classificada como validada quando o fluxo correspondente foi executado.

## 2. Resumo executivo

- O `main` remoto contém as Sprints 1 a 7. O checkout local estava quatro commits atrás e foi sincronizado por fast-forward antes dos testes. Uma implementação alternativa local e não publicada da Sprint 5 foi preservada no stash `audit-safety-sprint5-openai-alternative-2026-09-22`.
- A aplicação usa Next.js **16.3.5**, React **19.3.0**, TypeScript **6.0.3**, Supabase JS **2.117.0** e Fabric **7.4.0**.
- `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` foram concluídos com sucesso antes das correções. A suíte obteve **78 testes aprovados e 3 ignorados**; com o repositório do Portal disponível, os 3 testes de interoperabilidade também passaram.
- O Supabase está `ACTIVE_HEALTHY`, aponta para o projeto correto, possui 1 usuário/perfil ativo e 1 administrador ativo. Existem 4 templates, mas **nenhum conteúdo, versão, mídia, job de IA, aprovação ou publicação** para uma validação funcional autenticada.
- As 19 tabelas de aplicação avaliadas estão com RLS habilitado. Os quatro buckets usados pelo produto são privados.
- O Security Advisor do Supabase retorna dois alertas: seis funções `SECURITY DEFINER` executáveis por usuários autenticados e proteção contra senhas vazadas desabilitada. As funções possuem `search_path=''` e validações internas de sessão/papel, mas o alerta exige teste independente antes de produção.
- A IA usa fal.ai. Os modelos estão habilitados no banco, porém `FAL_KEY` e `SUPABASE_SERVICE_ROLE_KEY` não estão disponíveis no ambiente local auditado. Nenhum crédito foi consumido e nenhuma geração real foi executada.
- O pacote ZIP do AI Studio é interoperável com o importador do Portal no nível de código: 7 testes no AI Studio e 7 testes no Portal passaram. Não houve importação/publicação em ambiente de homologação.
- Não existe projeto Railway chamado AI Studio entre os quatro projetos acessíveis. Não há deploy, domínio, certificado, logs ou métricas do AI Studio para validar.
- Foram corrigidas lacunas locais de prontidão: headers de segurança, health check, configuração `railway.json`, CI, validação segura da origem de convites/recuperação e alinhamento do histórico de migrações.

## 3. Estrutura encontrada

| Área | Evidência | Diagnóstico |
|---|---|---|
| App Router | Rotas em `src/app`, `proxy.ts` e layouts protegidos | Estrutura moderna de Next.js e proteção no servidor. |
| Frontend | Componentes de dashboard, estúdio, editor, editorial, publicações e administração | Módulos separados e tipados; não é apenas uma interface estática. |
| Backend | Server Actions e Route Handlers em `src/app/api` | Autorização e persistência implementadas no servidor. |
| Supabase | Clientes browser/server/admin e 13 versões de migração reconciliadas | Conectado ao projeto correto; chave administrativa ausente no ambiente local. |
| Editor | Fabric.js, hooks de histórico/persistência, exportação e Storage privado | Núcleo testado; persistência real não homologada por falta de conteúdo de teste autenticado. |
| IA | Provedor fal.ai, fila, polling, Storage e governança | Implementado com mocks; provedor real não configurado. |
| Editorial | RPCs transacionais, fila, decisões, notificações e versões congeladas | Implementado; fluxo real entre dois usuários não executado. |
| Portal | Central de Publicações, ZIP, assinatura e API opcional | Interoperabilidade de código validada; operação real pendente. |
| Deploy | `railway.json`, `/api/health` e CI adicionados nesta auditoria | Nenhum serviço Railway do AI Studio existe. |

Dados mockados remanescentes não foram encontrados nas jornadas ativas de dashboard/IA. Os testes de IA usam provedor simulado deliberadamente e não representam integração real.

## 4. Validação das oito sprints

| Sprint | Status | Funcionalidades e evidências | Pendência e impacto |
|---|---|---|---|
| 1 — Estrutura e design | ✅ Validado | Dashboard e seis áreas internas compilam; Calibri com fallback, tokens azuis, sidebar recolhível, topbar e componentes responsivos estão em `globals.css`, `styles/tokens.ts` e `components`. Build lista todas as rotas. | Não houve ensaio visual automatizado em múltiplos dispositivos; incluir na homologação, sem bloquear o ambiente técnico. |
| 2 — Supabase e autenticação | 🟡 Pendente de configuração | Projeto correto e saudável; login/logout/recuperação implementados; rota protegida redirecionou `/dashboard` para `/login`; APIs sem sessão retornaram 401; 4 testes anônimos contra o Supabase passaram; RLS habilitado. | Login válido, logout, recuperação por e-mail e convite não foram executados. Falta chave administrativa local e proteção contra senhas vazadas. Impede homologação completa. |
| 3 — Conteúdo e templates | 🟡 Pendente de configuração | CRUD, duplicação, filtros, 4 templates persistidos e regras de edição estão implementados; validações unitárias passam. | O banco possui 0 conteúdos. Criar/editar/duplicar/consultar com usuário real não foi homologado. |
| 4 — Editor visual | 🟡 Pendente de configuração | Fabric.js, texto/imagem/formas, camadas, desfazer/refazer, autosave, versões, exportação e bucket privado existem; 5 testes do núcleo passaram. | Não houve jornada autenticada criar → salvar → reabrir → exportar em Supabase real nem teste visual nos quatro tamanhos de tela. |
| 5 — IA | 🟡 Pendente de configuração | fal.ai Queue API, modelos, cotas, referências, cancelamento, Storage, administração e 30 testes simulados estão implementados. | Sem `FAL_KEY` e `SUPABASE_SERVICE_ROLE_KEY`; geração real não testada. Modelos habilitados no banco devem permanecer indisponíveis na UI até as chaves e autorização de custo existirem. |
| 6 — Gestão editorial | 🟡 Pendente de configuração | Envio, versão congelada, fila, segregação, aprovação, ajustes, nova versão, arquivamento, histórico e notificações existem; 12 testes de regra passaram. | Só existe um usuário/admin e não há conteúdo. O fluxo autor/editor → aprovador distinto não pode ser executado. |
| 7 — Portal | 🟡 Pendente de configuração | ZIP, manifesto, SHA-256, assinatura, Central de Publicações, confirmação e API opcional existem. Todos os 7 testes de pacote/interoperabilidade do AI Studio e 7 testes do importador do Portal passaram. | Falta chave de assinatura, conteúdo aprovado e ensaio real. API automática está corretamente desabilitada e sem cliente. |
| 8 — QA e implantação | 🟠 Implementação incompleta | Typecheck, lint, 81 cenários automatizados, build e audit de dependências passaram. CI, headers, health check e `railway.json` foram adicionados. | Não há Railway, E2E autenticado, teste de carga, varredura DAST, baseline de desempenho nem homologação corporativa. |

## 5. Supabase

### 5.1 Conexão e inventário

**Status: ✅ Validado para conectividade; 🟡 para operação autenticada.**

- Projeto confirmado por API: `AI-Studio`, referência `idrseyhwkhlvedfgzecb`, região `us-east-2`, PostgreSQL 17, estado `ACTIVE_HEALTHY`.
- A URL local aponta para essa referência. Nenhum valor de chave foi incluído neste relatório.
- Contagens observadas: 1 usuário Auth, 1 perfil ativo, 1 administrador ativo, 4 templates, 1 log de auditoria e zero registros nas demais jornadas operacionais.
- Buckets privados: `editor-assets` (10 MiB), `ai-generated` (20 MiB), `ai-references` (10 MiB) e `publication-packages` (50 MiB).
- 37 políticas públicas e 5 políticas de `storage.objects` foram identificadas.

### 5.2 Migrações

O banco registrava versões aplicadas com timestamps diferentes dos arquivos publicados, e a migração de reversão estava ordenada antes do esquema que deveria reverter. A auditoria renomeou as versões definitivas e adicionou três marcadores vazios para alinhar o histórico sem reaplicar o esquema intermediário.

Ordem versionada atual:

1. `20260922173016_sprint_2_auth_content_security.sql`
2. `20260922190702_sprint_3_editorial_templates.sql`
3. `20260922195222_sprint_4_visual_editor.sql`
4. `20260922201414_sprint_4_editor_policy_fix.sql`
5. `20260922220044_sprint_5_ai_generation.sql` — marcador histórico
6. `20260922230948_sprint_5_ai_security_hardening.sql` — marcador histórico
7. `20260922231452_sprint_5_ai_table_grants.sql` — marcador histórico
8. `20260923001244_revert_previous_sprint_5_schema.sql`
9. `20260923001321_sprint_5_ai_image_generation.sql`
10. `20260923001423_sprint_6_editorial_workflow.sql`
11. `20260923001540_sprint_7_publications.sql`
12. `20260923002835_bootstrap_first_admin.sql` — marcador de bootstrap específico do ambiente
13. `20260923002948_set_first_admin_display_name.sql` — marcador sem dados pessoais

Antes de um próximo `supabase db push`, executar `supabase migration list --linked` e exigir correspondência entre Local e Remote.

### 5.3 Autenticação e segurança

- Consulta anônima às tabelas protegidas: negada.
- Duplicação anônima: negada.
- Upload anônimo no editor: negado.
- Credencial inválida: sessão não criada.
- Administrador ativo: existe exatamente um. As triggers protegem contra remoção do último administrador.
- Login válido, logout e e-mail de recuperação: ⚪ Não verificável sem credencial de homologação e sem autorizar envio de e-mail.
- Advisor: proteção de senhas vazadas desabilitada.
- Advisor: seis RPCs `SECURITY DEFINER` públicas para `authenticated`. O código fixa `search_path`, usa `auth.uid()`, checa usuário ativo/papel/autor/estado e contém testes SQL, mas os testes transacionais não puderam ser executados pelo conector somente leitura.

### 5.4 Roteiros SQL

`database_security.sql` e `sprint_4_editor.sql` passaram pelo conector. Os roteiros das Sprints 3, 5, 6 e 7 tentam criar fixtures dentro de transação com `ROLLBACK`; o conector recusou os `INSERT` com `25006 cannot execute INSERT in a read-only transaction`. Isso é uma limitação do canal de auditoria, não uma aprovação nem uma reprovação das regras.

## 6. Inteligência artificial

**Provedor implementado:** fal.ai.
**Modelos cadastrados e habilitados:** `fal-ai/flux/schnell`, `fal-ai/flux/dev` e `fal-ai/flux/dev/image-to-image`.
**Autenticação:** `Authorization: Key <FAL_KEY>`, exclusivamente no servidor.
**Estado:** 🟡 Pendente de configuração.

O backend implementa fila, polling, cancelamento, validação de hosts HTTPS, proteção SSRF, assinatura binária, limite de 20 MiB, cota atômica, consentimento de imagem de referência, Storage privado e inserção no editor. A documentação oficial do fal.ai recomenda `FAL_KEY` no servidor e proxy server-side; o modelo schnell informa cobrança por megapixel. Consultar [documentação do modelo](https://fal.ai/models/fal-ai/flux/schnell/api) e [preços vigentes](https://fal.ai/pricing) antes do teste.

Não foi executado teste real porque não há chave e não houve autorização para consumo. Nenhum resultado foi enviado a serviço externo.

## 7. Railway

**Status: 🔴 Não implementado no ambiente; configuração de código preparada.**

A conta conectada possui quatro projetos (`ifrs`, `primosports-system`, `giro-certo`, `radar-financeiro`) e nenhum projeto AI Studio. Portanto não existem serviço, branch, deploy, domínio, HTTPS, logs, métricas, variáveis ou rollback do AI Studio para consultar.

O repositório agora contém `railway.json` com `npm ci && npm run build`, `npm start`, health check `/api/health`, timeout de 120 s e reinício em falha. O Railway só troca o tráfego após o health check retornar 200, conforme a [documentação oficial](https://docs.railway.com/guides/roll-back-bad-deploy#prevent-bad-deploys-with-a-healthcheck).

## 8. Integração com o Portal da Contabilidade

**Status: 🟡 Pendente de configuração e homologação.**

- Repositório localizado: `jonathanbrunosb/portal-contabilidade`, commit auditado `9271dae`.
- A Central de Publicações, manifesto 1.0, ZIP, imagem PNG, checksums, assinatura ECDSA, histórico e confirmação existem no AI Studio.
- O importador real do Portal aceitou pacote válido, bloqueou adulteração/path traversal/manifesto malicioso e tratou duplicidade/substituição: 7/7 testes passaram.
- O Portal continua essencialmente estático/GitHub Pages. A alternativa operacional segura é ZIP + importação administrativa + confirmação manual.
- A API servidor-servidor está desabilitada, exige token com hash no banco e não possui cliente ativo. Não habilitar enquanto o Portal não tiver backend HTTPS seguro para guardar a credencial.
- Não houve publicação automática e isso está de acordo com o requisito de controle humano.

## 9. Segurança, qualidade e desempenho

| Comando/teste | Resultado |
|---|---|
| `npm run typecheck` | Aprovado. |
| `npm run lint` | Aprovado. |
| `npm run test` | 81 aprovados, 3 ignorados sem Portal; os 3 ignorados passaram quando o Portal foi disponibilizado. |
| `npx vitest run tests/supabase-security.integration.test.ts --reporter=verbose` | 4/4 aprovados contra Supabase real, em contexto anônimo. |
| `npx vitest run tests/publication-package.test.ts` com `PORTAL_REPO_PATH` | 7/7 aprovados. |
| `node --test tests/*.test.mjs` no Portal | 7/7 aprovados. |
| `npm run build` | Aprovado; 27 rotas e Proxy gerados. |
| `npm audit --omit=dev --json` | 0 vulnerabilidades de produção conhecidas. |
| Smoke HTTP de produção local | `/login` 200, `/dashboard` 307 para login, APIs de IA/Portal 401 sem autenticação. |
| Headers antes da correção | Ausentes. |
| Teste real de IA | Não executado: sem credencial/autorização de custo. |
| Login/CRUD/editor/editorial reais | Não executados: sem conta de homologação disponibilizada. |
| Teste responsivo/performance/DAST | Não implementado. |

O Advisor de performance aponta 21 chaves estrangeiras sem índice de cobertura, 3 conjuntos de políticas permissivas duplicadas e vários índices ainda não utilizados. O banco está vazio; índices não utilizados ainda não indicam desperdício real. Medir com carga representativa antes de remover ou criar índices indiscriminadamente.

## 10. Pendências e plano de ação priorizado

### Separação por responsável

| Grupo | Itens |
|---|---|
| Grupo A — correções técnicas executáveis pelo Codex | Headers, health check, CI, configuração Railway, validação de URL e histórico de migrações foram corrigidos; P2-01 e P2-02 podem avançar quando houver ambiente/dados de homologação. |
| Grupo B — configurações que dependem do usuário | P0-01, P0-02, P0-03, P1-02, P1-03 e P1-04. |
| Grupo C — dependências corporativas | Aceite de Segurança/DBA para P1-01; autorização do fal.ai, orçamento, tratamento de dados, rede corporativa, domínio, cofre de segredos e aprovação formal de produção. |

### Pendência P0-01 — Implantação Railway inexistente

**Prioridade:** P0.
**Situação identificada:** não existe projeto/serviço AI Studio na conta Railway acessível.
**Evidência:** listagem da API Railway retornou quatro projetos, nenhum relacionado ao AI Studio.
**Impacto:** não há ambiente de homologação ou produção, URL HTTPS, logs, health check ou rollback.
**Responsável:** usuário.
**Ação necessária:** criar o projeto e serviço somente após aprovação de implantação.

**Passo a passo para conclusão:**

1. Acessar Railway → **New Project** → **Deploy from GitHub repo**.
2. Selecionar `jonathanbrunosb/AI-Studio` e a branch `main`.
3. Confirmar que o serviço detectou `railway.json`; root directory deve permanecer na raiz.
4. Cadastrar as variáveis da seção 11 sem colá-las em issues, commits ou conversas.
5. Gerar um domínio temporário em **Settings → Networking → Generate Domain**.
6. Atualizar `NEXT_PUBLIC_APP_URL` com a origem HTTPS e configurar a mesma URL no Supabase Auth.
7. Iniciar o primeiro deploy de homologação; não promover a produção.
8. Em **Deployments → View Logs**, conferir build, start e resposta 200 em `/api/health`.
9. Executar o roteiro de homologação da seção 12.
10. Testar rollback: selecionar o deploy anterior aprovado e usar **Redeploy/Rollback**, confirmando o commit e o health check antes de retornar à versão nova.

**Critério de conclusão:** serviço de homologação saudável, HTTPS ativo, `/api/health` 200, logs sem segredo e rollback ensaiado.
**Status:** não iniciado.

### Pendência P0-02 — Homologação autenticada e segregação de funções

**Prioridade:** P0.
**Situação identificada:** há somente um usuário/admin e zero conteúdos.
**Evidência:** contagens diretas no Supabase.
**Impacto:** login válido, CRUD, editor, auto-save, aprovação segregada e publicação não foram comprovados.
**Responsável:** usuário e Codex/QA.
**Ação necessária:** provisionar contas corporativas de homologação distintas.

**Passo a passo para conclusão:**

1. No AI Studio de homologação, entrar com o administrador existente.
2. Em **Administração**, convidar um usuário com papel `editor` e outro com papel `approver`; usar contas de teste corporativas autorizadas.
3. Confirmar os convites e definir senhas fortes.
4. Como editor, criar conteúdo, aplicar template, editar, salvar, reabrir e exportar.
5. Enviar para o aprovador; confirmar que o editor não aprova o próprio material.
6. Solicitar ajustes, editar novamente e aprovar uma versão congelada.
7. Verificar logs de auditoria e isolamento entre usuários.

**Critério de conclusão:** matriz editor/aprovador/admin executada com evidências e sem bypass.
**Status:** aguardando configuração.

### Pendência P0-03 — Configuração segura de autenticação

**Prioridade:** P0.
**Situação identificada:** proteção contra senhas vazadas desabilitada e URLs produtivas ainda inexistentes.
**Evidência:** Supabase Security Advisor e ausência do domínio Railway.
**Impacto:** política de senha abaixo do nível recomendado e links de convite/recuperação sem destino produtivo validado.
**Responsável:** usuário/Segurança da Informação.
**Ação necessária:** habilitar controles de Auth e URLs autorizadas.

**Passo a passo para conclusão:**

1. Supabase Dashboard → projeto AI-Studio → **Authentication → Attack Protection**.
2. Habilitar **Leaked Password Protection** e salvar.
3. Em **Authentication → URL Configuration**, definir **Site URL** como `https://<dominio-aprovado>`.
4. Adicionar `https://<dominio-aprovado>/auth/callback` às Redirect URLs; manter localhost apenas para desenvolvimento autorizado.
5. No Railway, definir `NEXT_PUBLIC_APP_URL` com a mesma origem HTTPS, sem barra final.
6. Testar convite, recuperação, atualização de senha e logout.

**Critério de conclusão:** Advisor sem alerta de senha vazada e todos os links retornando ao domínio oficial.
**Status:** aguardando domínio.

### Pendência P1-01 — Revisão das funções `SECURITY DEFINER`

**Prioridade:** P1.
**Situação identificada:** seis RPCs privilegiadas são executáveis por `authenticated`.
**Evidência:** Security Advisor lista `archive_content`, `create_new_content_version`, `decide_content_review`, `list_eligible_reviewers`, `submit_content_for_review` e `transition_publication`.
**Impacto:** erro futuro em uma validação interna pode ampliar privilégios; o linter continuará sinalizando o ambiente.
**Responsável:** Codex/DBA/Segurança da Informação.
**Ação necessária:** executar os testes SQL completos em branch Supabase de homologação e decidir entre aceite formal ou wrappers `SECURITY INVOKER`/schema privado.

**Passo a passo para conclusão:**

1. Criar uma branch de banco de homologação ou iniciar Supabase local.
2. Aplicar todas as migrações na ordem versionada.
3. Executar `supabase/tests/database_security.sql` e `sprint_3` a `sprint_7` com conexão PostgreSQL capaz de criar fixtures transacionais.
4. Revisar `auth.uid()`, usuário ativo, papel, autoria, estado e `search_path=''` em cada função.
5. Registrar o risco aceito ou criar migração de hardening sem alterar o contrato das RPCs.
6. Rodar novamente o Security Advisor e testes de regressão.

**Critério de conclusão:** testes SQL completos aprovados e aceite de Segurança/DBA ou Advisor sem alerta.
**Status:** aguardando validação.

### Pendência P1-02 — Credenciais e governança da IA

**Prioridade:** P1.
**Situação identificada:** modelos habilitados, mas provedor e service role ausentes no ambiente auditado.
**Evidência:** `FAL_KEY`, `AI_IMAGE_PROVIDER` e `SUPABASE_SERVICE_ROLE_KEY` ausentes; zero jobs/mídias.
**Impacto:** nenhuma geração pode ser concluída; habilitação visual pode criar expectativa incorreta.
**Responsável:** usuário e Segurança da Informação.
**Ação necessária:** aprovar provedor/custo/tratamento de dados e configurar segredos no Railway.

**Passo a passo para conclusão:**

1. Obter aprovação corporativa para envio de prompts e referências ao fal.ai.
2. No fal.ai Dashboard → **Keys**, criar uma chave dedicada ao ambiente e configurar limite/orçamento. Não enviar a chave nesta conversa.
3. Railway → serviço AI Studio → **Variables**: `AI_IMAGE_PROVIDER=fal`, `FAL_KEY=<segredo>` e `SUPABASE_SERVICE_ROLE_KEY=<segredo do projeto correto>`.
4. No AI Studio → **Administração → IA**, habilitar inicialmente apenas `fal-ai/flux/schnell` e definir cota 3 para o usuário de teste.
5. Gerar uma imagem 1:1 sem dado pessoal; confirmar job, Storage `ai-generated`, `media_assets`, inserção no canvas, save e reabertura.
6. Conferir faturamento real no fal.ai e atualizar custos de referência.

**Critério de conclusão:** uma geração controlada concluída e armazenada, sem segredo no cliente/log, com custo conciliado.
**Status:** aguardando autorização e credencial.

### Pendência P1-03 — Assinatura e homologação Portal

**Prioridade:** P1.
**Situação identificada:** interoperabilidade de código aprovada, mas sem chave de assinatura e sem publicação de homologação.
**Evidência:** `PORTAL_SIGNING_PRIVATE_KEY` ausente, zero publicações e testes somente com chaves efêmeras.
**Impacto:** o Portal não consegue comprovar a origem de um pacote real.
**Responsável:** usuário/área responsável pelo Portal/Codex QA.
**Ação necessária:** configurar o par de chaves e executar ZIP → importação → publicação → confirmação.

**Passo a passo para conclusão:**

1. Gerar chave ECDSA P-256 PKCS#8 em estação segura conforme `.env.example`.
2. Cadastrar a chave privada como `PORTAL_SIGNING_PRIVATE_KEY` no Railway.
3. Copiar somente a chave pública SPKI exibida em **Administração → Integrações** para `data/config.json` do Portal.
4. Ativar `aiStudio.requireSignature: true` no Portal.
5. Preparar pacote de um conteúdo fictício aprovado, baixar o ZIP e importar no ambiente de homologação do Portal.
6. Conferir preview, hashes, assinatura, estado “Em revisão”, aprovação humana e confirmação manual no AI Studio.

**Critério de conclusão:** pacote assinado aceito; pacote adulterado e chave divergente recusados; publicação não automática.
**Status:** aguardando configuração.

### Pendência P1-04 — Segredos e URL de produção

**Prioridade:** P1.
**Situação identificada:** ambiente local tem apenas configuração pública e URL localhost; segredos operacionais não estão configurados.
**Evidência:** inventário de nomes das variáveis, sem leitura/exposição dos valores.
**Impacto:** convites, IA, pacotes e Server Actions entre réplicas não ficam operacionais.
**Responsável:** usuário.
**Ação necessária:** cadastrar todas as variáveis no Railway e separar homologação/produção.

**Passo a passo para conclusão:** usar a tabela da seção 11, aplicar primeiro em homologação, reiniciar o serviço e testar `/api/health`, convites, IA e assinatura.
**Critério de conclusão:** todas as variáveis obrigatórias presentes, rotação documentada e nenhum segredo exposto no browser ou GitHub.
**Status:** não iniciado.

### Pendência P2-01 — Cobertura E2E, responsividade e desempenho

**Prioridade:** P2.
**Situação identificada:** não há Playwright/Cypress, teste de carga ou orçamento de Web Vitals.
**Evidência:** suíte contém Vitest/SQL, sem configuração E2E.
**Impacto:** regressões de interação e layout podem chegar à homologação; escala não foi dimensionada.
**Responsável:** Codex/QA.
**Ação necessária:** adicionar E2E em homologação para 1440, 1366, tablet e smartphone; medir dashboard/editor e upload/exportação.
**Passo a passo para conclusão:** criar dados descartáveis, automatizar login por usuário de teste, executar jornadas principais, coletar trace/screenshot, definir limites de LCP/erro e incluir no CI protegido.
**Critério de conclusão:** jornadas críticas verdes nas resoluções e orçamento aprovado.
**Status:** não iniciado.

### Pendência P2-02 — Ajuste de índices após carga

**Prioridade:** P2.
**Situação identificada:** Advisor aponta 21 FKs sem índice de cobertura e políticas permissivas duplicadas.
**Evidência:** relatório de performance do Supabase.
**Impacto:** possível degradação com crescimento; hoje não mensurável porque as tabelas operacionais estão vazias.
**Responsável:** DBA/Codex.
**Ação necessária:** gerar volume representativo em homologação, usar `EXPLAIN (ANALYZE, BUFFERS)` e criar apenas índices comprovadamente úteis.
**Critério de conclusão:** consultas críticas dentro do SLO e Advisor revisado sem indexação especulativa.
**Status:** aguardando dados de teste.

## 11. Variáveis de ambiente e configuração externa

| Variável | Finalidade | Onde configurar | Obrigatória para |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto `idrseyhwkhlvedfgzecb` | Railway e `.env.local` | Toda a aplicação. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do projeto | Railway e `.env.local` | Auth/Data API no browser/SSR. |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações administrativas controladas | Somente Railway/servidor | Convites, IA e publicações. |
| `NEXT_PUBLIC_APP_URL` | Origem HTTPS canônica | Railway | Convites, recuperação e callbacks. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Chave estável entre réplicas/deploys | Railway | Consistência de Server Actions. |
| `AI_IMAGE_PROVIDER` | Seleção do provider | Railway; valor seguro atual `fal` | Sprint 5. |
| `FAL_KEY` | Credencial fal.ai | Somente Railway/servidor | Geração real. |
| `PORTAL_SIGNING_PRIVATE_KEY` | Assinatura ECDSA dos pacotes | Somente Railway/servidor | Origem verificável no Portal. |

Nunca cadastrar chaves privilegiadas com prefixo `NEXT_PUBLIC_`. Manter variáveis distintas por ambiente e registrar responsável/data de rotação no cofre corporativo.

## 12. Roteiro de homologação

1. CI verde no commit candidato e `npm audit` sem vulnerabilidade alta/crítica.
2. Migrações Local/Remote alinhadas e roteiros SQL completos aprovados em banco de homologação.
3. Login, logout, convite, recuperação e inativação testados.
4. Editor cria conteúdo, salva automaticamente, reabre e exporta PNG/JPG nas dimensões lógicas.
5. Storage bloqueia anônimo e usuário sem acesso; URLs assinadas expiram.
6. Geração real controlada é armazenada e reutilizada no editor.
7. Editor envia para aprovador distinto; autoaprovação e edição de versão congelada são bloqueadas.
8. ZIP assinado é importado no Portal, permanece em revisão e só é publicado após confirmação humana.
9. Dashboard reflete dados reais após cada transição.
10. Railway passa health check, logs não contêm segredos e rollback é ensaiado.
11. Responsividade, acessibilidade básica, desempenho e segurança web são aprovados.
12. Segurança da Informação e dono do produto registram o aceite.

## 13. Critérios de liberação para produção

- Todas as pendências P0 corrigidas e validadas.
- P1-01 a P1-04 concluídas ou risco formalmente aceito pelo responsável competente.
- Ambiente de produção separado, domínio HTTPS definitivo e redirects limitados.
- Backup/PITR do Supabase, retenção de auditoria, rotação de chaves e resposta a incidentes definidos.
- Monitoramento de erro, disponibilidade, consumo de IA e orçamento configurados.
- Conteúdo fictício de homologação removido/arquivado conforme política.
- Go-live autorizado explicitamente pelo dono do produto; nenhum deploy automático decorrente desta auditoria.

## 14. Riscos e dependências corporativas

- Aprovação do fal.ai e das regras de retenção/processamento de prompts e imagens.
- Aprovação de custos e limites de consumo de IA.
- Liberação de Railway e Supabase na rede corporativa.
- Definição de contas institucionais editor/aprovador/admin e responsável por recertificação de acessos.
- Gestão das chaves no cofre corporativo e processo de rotação/revogação.
- Responsável operacional pelo Portal e pela confirmação de publicação.
- Política de backup, retenção de auditoria, classificação de imagens e resposta a incidentes.

## 15. Checklist executivo

| Nº | Etapa | Status | Responsável | Próxima ação |
|---:|---|---|---|---|
| 01 | Validação das Sprints 1 a 8 | 🟠 Parcial | Codex/QA | Concluir jornadas autenticadas e Sprint 8. |
| 02 | Supabase configurado | 🟡 Parcial | Codex/Usuário | Alinhar CLI e executar testes SQL completos. |
| 03 | Autenticação e permissões | 🟡 Parcial | Usuário/QA | Criar editor/aprovador de homologação e ativar senha vazada. |
| 04 | Storage operacional | ✅ Estruturalmente validado | Codex | Homologar upload/leitura com usuários reais. |
| 05 | API de IA configurada | 🟡 Aguardando credencial | Usuário/Segurança | Aprovar fal.ai, cadastrar chave e executar teste controlado. |
| 06 | Editor visual funcional | 🟡 Aguardando homologação | Codex/QA | Executar create/save/reopen/export em Supabase real. |
| 07 | Fluxo editorial validado | 🟡 Aguardando usuários | Usuário/QA | Testar segregação com editor e aprovador distintos. |
| 08 | Integração com portal | 🟡 Código validado | Usuário/Portal | Configurar assinatura e executar pacote real de homologação. |
| 09 | Railway configurado | 🔴 Não iniciado | Usuário | Criar serviço de homologação a partir do GitHub. |
| 10 | Segurança validada | 🟠 Parcial | Segurança/DBA/Codex | Tratar Advisor e executar SQL/DAST. |
| 11 | Homologação concluída | 🔴 Não iniciada | Usuário | Executar roteiro da seção 12. |
| 12 | Liberação para produção | 🔴 Não autorizada | Usuário | Autorizar somente após gates de produção. |

## 16. Correções realizadas nesta auditoria

- Sincronização segura do checkout com o `main` remoto; trabalho local divergente preservado em stash.
- Headers: CSP restrita a `base-uri`, `frame-ancestors` e `object-src`, além de HSTS, `nosniff`, anti-frame, Referrer e Permissions Policy.
- `GET /api/health` sem cache, com 503 quando a configuração pública obrigatória não existe.
- `railway.json` com build reproduzível, start, health check e política de reinício.
- Workflow GitHub Actions para typecheck, lint, testes e build.
- Validação canônica de `NEXT_PUBLIC_APP_URL`; convites/recuperação deixam de confiar no header `Origin` quando a variável estiver ausente.
- Restrição documentada de Node.js 22–24.
- Histórico local de migrações reconciliado com as versões realmente registradas no Supabase.
- Testes adicionais de health check e validação de origem.

## 17. Conclusão de prontidão

O AI Studio está **tecnicamente próximo de um ambiente de homologação**, não de produção. A arquitetura, os módulos principais e as barreiras de banco estão presentes; build, testes unitários, acesso anônimo e interoperabilidade do pacote foram comprovados. A entrada em operação permanece bloqueada por ausência de Railway, segredos/URLs produtivos, aprovação do provedor de IA, homologação com perfis distintos e fechamento dos alertas de segurança. Após concluir as pendências P0 e P1 e executar o roteiro de homologação, uma nova decisão formal de go-live deverá ser registrada.
