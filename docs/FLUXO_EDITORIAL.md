# Sprint 6 — Gestão editorial, aprovação e governança

## 1. Diagnóstico inicial (antes da sprint)

| Item | Situação encontrada | Ajuste |
|---|---|---|
| `contents.status` | Já tinha os 6 status do PRD; trigger bloqueava mudança direta de status. | Mantido. Trigger passou a aceitar mudanças só dentro das funções do fluxo. |
| `content_versions` | Tinha `working`, `checkpoint` e `frozen` (sem uso). Versões salvas já imutáveis. | `frozen` passou a ser a versão submetida à revisão. |
| `approval_events` | Tinha `actor_id`, `action`, `comment`. Sem vínculo com versão; sem política de escrita. | Novas colunas `version_id`, `from_status`, `to_status`, `cycle`; índice único de decisão por versão. |
| Gestão Editorial | Página somente leitura, sem decisões. | Módulo completo. |
| Notificações | Sino decorativo no header. | Tabela `notifications` + sino funcional. |
| Storage | Aprovador não conseguia ver imagens do autor; autor podia apagar arquivos usados. | Leitura por vínculo com o conteúdo; exclusão bloqueada para arquivos de versões submetidas. |

## 2. Fluxo

`draft → in_review → (changes_requested → in_review)* → approved → [Sprint 7: published]`.
`approved → draft` somente por **Criar nova versão** (a versão aprovada fica preservada em `approved_version_id`).
Qualquer status (exceto `archived`) → `archived` por autor ou administrador.

## 3. Funções transacionais (PostgreSQL)

| Função | O que valida | O que grava (numa única transação) |
|---|---|---|
| `submit_content_for_review` | Sessão ativa, perfil editor/admin, autor ou admin, status editável, título, campos obrigatórios da categoria (newsletter: fonte + link; sistemas: solução + funcionalidade), composição salva com elementos, composição não alterada desde a abertura do diálogo (`p_expected_working_updated_at`), arquivos disponíveis, aprovador elegível. | Versão `frozen` com a composição completa, dados editoriais, autor, data e lista de arquivos; status `in_review`; evento; notificações; auditoria. |
| `decide_content_review` | Trava a linha (`FOR UPDATE`), status `in_review`, versão igual à `submitted_version_id`, perfil aprovador/admin ativo, não é autor nem quem submeteu, aprovador designado (ou admin), justificativa para ajustes. | Evento vinculado à versão; status; `approved_version_id`/`approved_by`; notificação ao autor; auditoria. Índice único impede duas decisões na mesma versão. |
| `create_new_content_version` | Autor/admin, status `approved`. | Status `draft`, evento `new_version`, auditoria. Versão aprovada intocada. |
| `archive_content` | Autor (editor) ou admin. | Status `archived`, responsável, data e status anterior; evento; auditoria. Nada é excluído. |
| `list_eligible_reviewers` | Acesso ao conteúdo. | Lista aprovadores ativos, exceto autor e o próprio usuário. |

As funções ligam a variável de transação `app.editorial_transition`, a única forma de o trigger `protect_content_write` aceitar mudanças de status e das colunas de workflow. Usuários não conseguem ativá-la pela API.

## 4. Regras de segurança aplicadas

1. **Sem autoaprovação:** autor e quem submeteu não decidem, mesmo sendo administradores (banco + interface).
2. **Versões protegidas:** versões `frozen` não aceitam `update`; conteúdo em revisão/aprovado não aceita edição (trigger + RLS).
3. **Status só pelo fluxo:** `update` direto de `status` ou das colunas de workflow é recusado.
4. **Eventos protegidos:** usuários não têm `insert/update/delete` em `approval_events`.
5. **Elegibilidade no momento da decisão:** ativo + perfil `approver`/`admin`.
6. **Concorrência:** `FOR UPDATE` + checagem de versão + índice único por versão → a segunda decisão recebe `STATE_CHANGED` e a tela é recarregada.
7. **Arquivos:** a versão submetida guarda a lista de arquivos; a política de exclusão do Storage bloqueia a remoção desses arquivos; caminhos são únicos (UUID) e não há permissão de sobrescrita.
8. **Dados:** consultas com o cliente do usuário (RLS). Não há uso da chave de serviço no fluxo editorial.
9. **Notificações:** cada usuário lê e marca como lidas apenas as suas.

## 5. Interface

- **Gestão Editorial** (`/gestao-editorial`): indicadores reais, abas (Todos, Aguardando minha aprovação, Ajustes solicitados, Aprovados, Histórico), busca, filtros por categoria/status/responsável/período, paginação de 10 itens, miniaturas renderizadas da versão.
- **Revisão** (`/gestao-editorial/revisao/[id]`): informações à esquerda, pré-visualização da versão submetida no centro (com ampliação em resolução original), decisão e histórico completo à direita.
- **Estúdio**: botão "Enviar para aprovação" (diálogo com dados, pré-visualização, aprovador e observações), aviso de bloqueio por status, observações do aprovador, "Criar nova versão", "Arquivar" e link para o histórico. No editor visual, o botão salva a composição antes de abrir o envio.
- **Dashboard**: indicador de ajustes solicitados e seção "Pendências editoriais" por perfil.
- **Header**: sino com contador de não lidas, lista e "marcar como lidas".

## 6. Testes

- `supabase/tests/sprint_6_editorial_workflow.sql` (roles da API, com rollback): envio incompleto, autor como aprovador, alteração direta de status, edição em revisão, inserção direta de evento, editor tentando aprovar, justificativa obrigatória, notificações isoladas por usuário, decisão conflitante, reenvio com novo ciclo, aprovador não designado, decisão sobre versão antiga, aprovação vinculada à versão, edição de aprovado, nova versão preservando a aprovada, arquivamento preservando histórico e versões, autoaprovação de administrador.
- `tests/editorial-workflow.test.ts`: matriz de permissões, bloqueio por status, validação do envio e mensagens de erro.

## 7. Pendências e decisões para a Sprint 7

- Transição `approved → published` e integração com o Portal (status `published` previsto, não usado).
- "Criar nova versão" devolve o conteúdo para `draft`; a versão aprovada anterior permanece em `approved_version_id` e deve ser a referência de publicação até nova aprovação.
- Imagens da biblioteca reaproveitadas de **outro** conteúdo em rascunho podem não ser visíveis ao aprovador (a leitura segue o conteúdo de origem do arquivo). A tela de revisão avisa quando isso ocorre.
- Não há restauração de conteúdos arquivados (desarquivar), nem notificação por e-mail.
- Teste de concorrência real (duas sessões simultâneas) foi coberto por trava + índice único e por teste sequencial; recomenda-se um teste de carga no ambiente de homologação.
