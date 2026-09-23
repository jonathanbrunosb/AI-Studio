# Relatório final — Sprint 8 · Testes integrados, segurança, homologação e implantação

**Data:** 23/09/2026 · **Branch:** `claude/adoring-faraday-5iwlgv` · **Classificação: APTA PARA HOMOLOGAÇÃO** (não apta para produção — ver seção G)

---

## A. Resumo da implementação

A Sprint 8 montou uma infraestrutura de testes capaz de exercitar a aplicação real: navegador real, Supabase Auth, RLS e PostgREST reais, e IA simulada. Essa infraestrutura revelou **defeitos que impediam os processos essenciais em produção**. Antes das correções, **não era possível criar conteúdo, enviar para aprovação nem concluir uma geração de IA**, e o editor não salvava composições novas. Todos foram corrigidos e cobertos por testes de regressão.

### Defeitos encontrados e corrigidos

| # | Defeito | Impacto | Correção | Teste de regressão |
|---|---|---|---|---|
| 1 | Política RLS de `contents` bloqueava `INSERT … RETURNING` | **Crítico** — criação de conteúdo impossível em qualquer ambiente | Migração `sprint_8_hardening` (aplicada no Supabase) | `sprint_8_hardening.sql`, jornadas E2E |
| 2 | `list_eligible_reviewers`: coluna `id` ambígua | **Crítico** — envio para aprovação impossível | idem | `sprint_8_hardening.sql`, `journey-editorial` |
| 3 | Editor passava `type` ao construtor do Fabric 7 (somente leitura) | **Crítico** — inicialização interrompida; salvamento automático nunca ocorria | `use-editor.ts` | `journey-communique` |
| 4 | Finalização de jobs de IA usava `or()` em PATCH do PostgREST (erro descartado) | **Crítico** — gerações concluídas ficavam presas em "processando" | RPC atômica `claim_generation_finalize` | `journey-ai` |
| 5 | Fabric 7 usa origem central por padrão | **Alto** — modelo inicial, textos, formas e a **PNG do pacote de publicação** saíam deslocados | `fabric-setup.ts` | `journey-communique` (origem `left/top`) |
| 6 | Nova versão de conteúdo publicado não oferecida na interface | **Alto** — impossível atualizar comunicação publicada | `workflow-rules.ts` | unitário + `journey-publication` |
| 7 | CSP nova bloqueava `fetch(data:)` na preparação do pacote | **Alto** (regressão da própria Sprint 8, detectada antes da entrega) | decodificação local | `journey-publication` |
| 8 | Usuário desativado com sessão aberta entrava em loop de redirecionamento | Médio | `/auth/signout` (só para perfil inativo; sem CSRF de logout) | `permissions` |
| 9 | Redirecionamentos de route handlers usavam o host interno do servidor | Médio (atrás do proxy do Railway) | `appUrl` + `NEXT_PUBLIC_APP_URL` | unitário + `permissions` |
| 10 | Abrir o editor regravava a versão sem alteração | Médio — aviso falso de "não salvo", `updated_at` alterado a cada abertura | linha de base do salvamento | verificação E2E |
| 11 | Editor em tablet/celular: painéis sobre o canvas e canvas cortado | Médio | painéis recolhidos por largura, centralização segura, aviso < 768 px | `responsive` |
| 12 | `audit_logs` alterável/apagável pela chave do servidor | Médio (governança) | migração `sprint_8_audit_governance` (aplicada) | `sprint_8_audit_governance.sql` |
| 13 | Falhas transitórias do provedor de IA silenciosas | Baixo (observabilidade) | logs `ai.provider_transient`/`ai.finalize_failed` | — |
| 14 | Link de redefinição de senha derivado de cabeçalhos da requisição | Médio | `NEXT_PUBLIC_APP_URL` obrigatório em produção | — |

### Entregas adicionais

- **Segurança**: CSP com nonce por requisição (sem `unsafe-inline`/`unsafe-eval` em scripts), cabeçalhos defensivos, HSTS condicionado, `X-Powered-By` removido.
- **Operação**: `/api/health`, logs JSON com `X-Request-Id`, verificação de variáveis na inicialização.
- **Infraestrutura**: `railway.json`, CI (`.github/workflows/ci.yml`) e dependências fixadas.
- **Testes**: pilha E2E local reprodutível, com binários de SHA-256 fixado; 38 testes E2E; runner SQL.
- **Documentação**: ARCHITECTURE, SECURITY, DEPLOYMENT (ambientes, backup, monitoramento, rollback), manual com 14 telas reais e roteiro de homologação.
- **Volume**: 8 commits sobre `main` (113 arquivos, +2.235/−244 linhas).

---

## B. Estado dos módulos

Classificação da especificação: *Implementado e validado*, *Implementado com pendências*, *Parcialmente implementado*, *Não implementado* e *Não verificável*.

| Módulo | Status | Evidência |
|---|---|---|
| Dashboard | **Implementado e validado** (carregamento, papéis, 4 resoluções) | `responsive`, `performance`, `auth`; a exatidão dos indicadores não tem teste automatizado próprio |
| Estúdio de Criação | **Implementado e validado**, após as correções 1, 3, 5, 10 e 11 | `journey-communique`: criar → editar → salvar automaticamente → reabrir → versão; exportação PNG 1080×1080 conferida no arquivo |
| Biblioteca | **Implementado com pendências de validação** | Listagem verificada por E2E; filtros e duplicação cobertos por testes unitários e SQL (Sprint 3), sem E2E |
| Gestão Editorial | **Implementado e validado** | `journey-editorial`: envio, ajustes, reenvio, aprovação, bloqueio da versão (interface e banco), autoaprovação recusada (`SELF_APPROVAL`), arquivamento auditado; 3 contas distintas |
| Modelos | **Implementado com pendências de validação** | Página carrega nas 4 resoluções; a aplicação de template pela aba Templates não tem E2E (etapa 3 da homologação) |
| Administração | **Implementado com pendências de validação** | Bloqueio de acesso de editor e aprovador e 9 tentativas de escalonamento pelo banco bloqueadas (`permissions`); convite de usuários depende de e-mail real, sem E2E |
| Integração com IA | **Não verificável** (integração real) · fluxo **validado com simulador** | `journey-ai` com o simulador da Queue API; nenhuma geração real foi feita (sem credencial nem autorização de consumo). **Não declarar operacional** até a etapa 5 da homologação |
| Integração com Portal | **Implementado; exportação validada** · importação real **não verificável** | `journey-publication`: pacote assinado validado pelo **módulo real de importação do portal** (origem "verified"), adulteração de 1 byte recusada, chave errada recusada, confirmação pelo admin, nova versão preserva a publicação anterior. Exportação de não aprovado bloqueada (`NOT_APPROVED`, teste SQL). Importação no portal publicado e API automatizada (desabilitada por padrão) **não testadas entre as aplicações reais** |

---

## C. Segurança

### Vulnerabilidades e fragilidades identificadas → tratamento

| Achado | Severidade | Situação |
|---|---|---|
| Trilha de auditoria mutável pela chave do servidor | Média | **Corrigido**: trilha imutável, com retenção controlada |
| Redirecionamentos e links de senha dependentes do host da requisição | Média | **Corrigido** |
| Loop em sessão de usuário desativado (acesso já era negado) | Baixa | **Corrigido** |
| Ausência de CSP e de cabeçalhos defensivos | Média | **Corrigido** |
| Binários de teste sem verificação de integridade | Baixa | **Corrigido** (SHA-256) |
| Proteção contra senhas vazadas desativada no Supabase Auth | Média | **Pendente**: ativar no painel (configuração, não código) |

### Controles verificados por teste

- Rotas protegidas: 9 páginas redirecionam sem sessão.
- APIs retornam 401 sem sessão; a API do Portal recusa token forjado.
- Proteção contra open redirect.
- Mensagens neutras no login e na recuperação de senha.
- Nonce da CSP único por requisição, sem violações de CSP.
- Segregação de funções na interface e no banco.
- Escalonamento de privilégio bloqueado em 9 vetores.
- Isolamento de conteúdo e de imagem de outros usuários.
- Integridade e assinatura do pacote de publicação.

### Riscos residuais

1. `style-src 'unsafe-inline'`: exigido por React/Fabric; risco baixo.
2. Limitação de tentativas de login delegada ao Supabase Auth.
3. Limitador em memória da API do Portal: válido para instância única.
4. Seis funções `SECURITY DEFINER` executáveis por usuários autenticados (advisor): intencionais, todas validam `auth.uid()`, papel e status internamente.
5. Nenhum teste de intrusão independente realizado.
6. Dados em **us-east-2 (EUA)**: avaliar residência de dados frente à LGPD e às políticas corporativas.

`npm audit`: **0 vulnerabilidades**.

---

## D. Banco de dados

- **10 migrações versionadas.** No Supabase de produção (`idrseyhwkhlvedfgzecb`) foram aplicadas nesta sprint `sprint_8_hardening` e `sprint_8_audit_governance`. Ambas são aditivas e não destrutivas. A base de produção tinha 0 conteúdos e 1 usuário.
- **RLS** habilitado em todas as tabelas públicas, sem concessões a `anon`. Grants conferidos diretamente em produção, por exemplo em `audit_logs`: `service_role` tem só `INSERT`/`SELECT`, e `authenticated` só `SELECT`.
- **Testes SQL** (`npm run test:sql`) — **8/8 aprovados** em banco descartável:
  - isolamento por usuário;
  - grants por coluna;
  - proteção de status e autoria;
  - cota de IA atômica;
  - fluxo editorial completo com segregação;
  - publicação: idempotência, substituição, confirmação duplicada;
  - regressões da Sprint 8;
  - imutabilidade da auditoria.
- **Advisors pós-migração**:
  - Segurança: 6 avisos de `SECURITY DEFINER` (intencionais) e 1 de proteção de senha vazada (pendente).
  - Desempenho: advertências de políticas duplicadas eliminadas; restam 14 FKs de colunas de auditoria sem índice e índices "não usados" (INFO; a base está vazia).
- **Storage**: 4 buckets privados com URLs assinadas. No E2E o Storage é simulado; as políticas do Storage são cobertas pelos testes SQL.

---

## E. Infraestrutura

| Item | Situação |
|---|---|
| Railway | `railway.json` pronto: Railpack, build/start, healthcheck `/api/health`, restart. **Nenhum serviço criado** (aguarda aprovação). O Railway declarou o `railway.json` descontinuado (suporte até **01/12/2026**); migrar para IaC |
| Ambientes | Estratégia documentada (dev, CI, homologação, produção). **Projeto Supabase de homologação não existe** e é pré-requisito |
| Supabase | Organização no **plano Free**: sem backup automático, com pausa após 7 dias de baixa atividade; região us-east-2 |
| CI | Workflow com 3 jobs (qualidade, SQL, E2E). **Ainda não executado no GitHub** (roda no primeiro PR) |
| Variáveis | Documentadas (`.env.example`, DEPLOYMENT §2); validação automática na inicialização |
| Monitoramento | Logs estruturados e correlação implementados. **Alertas e monitor externo não configurados** |
| Backup e recuperação | Estratégia e procedimento documentados. **Teste de restauração não executado** (sem ambiente apropriado; restauração em produção não autorizada) |
| Rollback | Documentado (aplicação por redeploy; banco por migração corretiva) |

---

## F. Testes

| Suíte | Resultado | Observação |
|---|---|---|
| Lint (ESLint) e tipos (TypeScript) | Aprovado | — |
| Unitários (Vitest) | **93 aprovados**, 4 ignorados | Os 4 ignorados exigem acesso ao Supabase real, bloqueado nesta rede |
| SQL | **8/8** | — |
| Build de produção | Aprovado | Todas as rotas dinâmicas (nonce da CSP) |
| E2E (Playwright) | **38/38** em pilha limpa | auth 6, segurança 13, permissões 6, comunicado 2, IA 2, editorial 4, publicação 1, responsividade 1, desempenho 2, manual 1 |

### Falha pendente

Em 1 de 6 execuções completas, a jornada de publicação falhou ao aguardar a mensagem de pacote gerado. Não houve reprodução em 5 execuções seguintes, nem isolada. **A causa raiz não foi estabelecida**; o caso fica monitorado no CI e não foi tratado como "instabilidade".

### Desempenho medido

Ambiente local: build de produção e pilha local, sem latência de rede. **Não representa Railway/Supabase em nuvem.**

- Páginas (mediana de 5 carregamentos, cache aquecido): TTFB entre 55 e 99 ms; `load` entre 148 e 199 ms.
- Cache vazio (transferência comprimida):

| Página | Transferência | Tempo |
|---|---|---|
| Login | 152 KB | 189 ms |
| Dashboard | 181 KB | 264 ms |
| Editor | 447 KB | 302 ms |

- Operações (mediana de 3 execuções):

| Operação | Tempo |
|---|---|
| Cadastro | 209 ms |
| Abertura de projeto no editor | 618 ms |
| Salvamento de versão | 202 ms |
| Exportação PNG (66 KB) | 123 ms |

- Heap JS máximo do editor: 66 MB.
- `/api/health`: mediana de 6 a 8 ms.
- A latência real Brasil → us-east-2 deve ser medida na homologação.

### Responsividade

1920×1080, 1366×768, 768×1024 e 390×844: **nenhuma rolagem horizontal** em 7 páginas × 4 resoluções. O editor visual **não é utilizável em celular** (aviso exibido). Testado apenas no Chromium; Edge usa o mesmo motor. Firefox e Safari não foram testados.

---

## G. Prontidão para produção

### Classificação: **APTA PARA HOMOLOGAÇÃO**

Os processos essenciais estão funcionando e comprovados por testes automatizados com autenticação, RLS e segregação reais. A aplicação **não está apta para produção**: requisitos de infraestrutura e comprovações entre sistemas reais ainda estão pendentes, e nenhum deles se resolve com código.

| Critério de liberação | Situação | Evidência / pendência |
|---|---|---|
| Autenticação | ✅ Validado | `auth`, `permissions` |
| Controle de acesso | ✅ Validado | `permissions`, `journey-editorial` |
| Banco de dados | ✅ Validado | 10 migrações; 8 suítes SQL; produção conferida |
| RLS | ✅ Validado | Testes SQL e E2E via PostgREST real |
| Storage | ⚠️ Parcial | Buckets privados em produção e políticas testadas em SQL; no E2E o Storage é simulado |
| Editor visual | ✅ Validado | Criação, edição, salvamento, reabertura e exportação 1080×1080 |
| Integração com IA | ❌ Pendente | Geração real não realizada; **manter desabilitada em produção até a etapa 5 da homologação** |
| Gestão editorial | ⚠️ Automatizado ✅ · homologação ⏳ | Fluxo completo aprovado em E2E; falta a homologação com usuários |
| Integração com portal | ⚠️ Exportação ✅ · importação real ⏳ | Pacote validado pelo módulo do portal; automação por API desabilitada (não testada) |
| Auditoria | ✅ Validado | Operações críticas registradas; trilha imutável; **prazo de retenção a definir** |
| Segurança | ⚠️ | Sem vulnerabilidade crítica ou alta conhecida; pendente ativar proteção de senha vazada |
| Build | ✅ | Build de produção aprovado |
| Implantação | ❌ | Não implantado (aguarda aprovação) |
| Homologação | ❌ | Roteiro pronto (`docs/HOMOLOGACAO.md`), não executado |

### Pré-requisitos para produção, em ordem

1. **Decidir o plano Supabase**: Pro no mínimo, para backups diários e fim da pausa por inatividade. Avaliar também a região e a residência de dados.
2. Criar o **projeto Supabase de homologação** e o **projeto Railway** (homologação e produção). Exige aprovação.
3. Ativar a **proteção contra senhas vazadas** e configurar as URLs de autenticação.
4. Executar o **roteiro de homologação** com 3 pessoas distintas, incluindo a geração real de IA (autorizando o consumo) e a importação no portal.
5. Configurar **alertas e monitor de disponibilidade**; executar o **teste de restauração** em projeto separado.
6. Definir o **prazo de retenção da auditoria**.
7. Após a validação de HTTPS e domínio, ativar HSTS. Migrar `railway.json` para IaC até 01/12/2026.
