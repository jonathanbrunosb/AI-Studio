# Sprint 5 — Geração de imagens com IA

## 1. Provedor escolhido: fal.ai

| Critério | Avaliação |
|---|---|
| API oficial | Queue API documentada (`https://queue.fal.run/{model}`), autenticação `Authorization: Key <FAL_KEY>`. |
| Texto → imagem | FLUX.1 [schnell] e FLUX.1 [dev]. |
| Imagem de referência | FLUX.1 [dev] image-to-image (`image_url`). |
| Proporção/resolução | `image_size` com largura/altura customizadas (múltiplos de 16). |
| Assíncrono | Fila nativa: `request_id`, `status_url`, `response_url`, `cancel_url`. |
| Custo | Cobrança por megapixel. Valores de referência cadastrados: US$ 0,003 (schnell), 0,025 (dev), 0,03 (image-to-image) por imagem ≈1 MP. **Confirmar em fal.ai/pricing antes de liberar.** |
| Custo efetivo | A Queue API **não** retorna o valor cobrado por solicitação; `actual_cost` fica nulo e aparece como "Indisponível". Conciliar pelo faturamento do fal.ai. |
| Dados enviados | O prompt e, quando houver, a URL temporária (10 min) da referência. Revisar os termos de uso/retenção do fal.ai com Segurança da Informação. |

## 2. Arquitetura

```
Painel de IA (ai-panel.tsx)
  └─ POST /api/ai/generations ─► getGenerationContext (sessão, perfil ativo, papel)
        └─ submitGeneration: valida modelo/parâmetros ─► conteúdo editável ─► referência (classificação)
             ─► reserve_generation_job (cota atômica no banco) ─► provider.submit ─► job "processing"
  └─ GET /api/ai/generations/{id} (polling a cada 3 s, até 5 min)
        └─ refreshGeneration: status no provedor ─► ao concluir: claim ─► download (host permitido, ≤20 MB,
             validação por assinatura binária) ─► bucket ai-generated ─► media_assets ─► job "completed"
  └─ Ações: inserir no canvas / usar como fundo (use-editor) / salvar na biblioteca / excluir (lógico)
```

| Pasta | Conteúdo |
|---|---|
| `src/lib/ai/providers` | Contrato `ImageGenerationProvider`, `FalImageProvider`, registro e provedor selecionado (`AI_IMAGE_PROVIDER`). |
| `src/lib/ai/models` | Catálogo com capacidades reais; o banco (`ai_models`) só habilita/desabilita e ajusta custo. |
| `src/lib/ai/services` | Validação, serviço de geração (independente de Supabase), status, consultas e consolidação de consumo. |
| `src/lib/ai/prompts` | Presets (comunicado, newsletter, sistemas, campanha) e montagem do prompt final com proibição de textos. |
| `src/lib/ai/repository` | Implementação Supabase do repositório. |
| `src/app/api/ai/*` | Route Handlers: gerações, status, cancelamento, referências e ações sobre imagens. |

Para incluir um novo provedor: implementar `ImageGenerationProvider`, registrá-lo em `provider-registry.ts`, adicionar os modelos ao catálogo e inserir as linhas em `ai_models` via migração.

## 3. Banco de dados (migração `20260922220000_sprint_5_ai_image_generation.sql`)

- `generation_jobs`: novos campos `provider`, `model`, `prompt`, `settings`, `external_request_id`, `error_message`, `estimated_cost`, `actual_cost`, `image_count`, `completed_at`, `finalizing_at`, `parent_job_id`. Status padronizados para `pending/processing/completed/failed/canceled` (dados antigos `queued`/`cancelled` convertidos). `created_by` corresponde ao `requested_by` da especificação (mantido para não quebrar políticas existentes).
- `media_assets`: `bucket`, `source`, `generation_job_id`, `width`, `height`, `size_bytes`, `in_library`, `sensitivity`, `deleted_at`.
- Novas tabelas `ai_models`, `ai_settings` (singleton) e `ai_user_limits`, com RLS e auditoria por trigger.
- Função `reserve_generation_job` (somente `service_role`): trava por usuário (`pg_advisory_xact_lock`), verifica integração, usuário ativo, modelo habilitado e cota (conta `pending`/`processing` + concluídos no período) e registra auditoria.
- Buckets privados `ai-generated` (20 MB) e `ai-references` (10 MB). Leitura condicionada à visibilidade do registro em `media_assets`; escrita apenas pelo backend.

### Uso da chave de serviço
Usuários não possuem `insert/update` em `generation_jobs` nem podem gravar nos buckets de IA; isso impede falsificar status, custos ou resultados. O backend usa `service_role` apenas depois de validar sessão, papel e acesso ao conteúdo com o cliente do usuário (RLS). Leituras e URLs assinadas exibidas ao usuário usam o cliente do usuário.

## 4. Segurança e governança

- Credenciais apenas no servidor; mensagens ao usuário nunca incluem respostas brutas do provedor; logs não registram prompts nem arquivos.
- Resultados baixados apenas de hosts HTTPS do fal.ai (proteção SSRF) e validados pelo conteúdo binário (PNG/JPEG/WebP).
- Referências: confirmação de autorização obrigatória; classificação `restricted`/`confidential` bloqueada, salvo autorização expressa do administrador; URL temporária de 10 minutos para o provedor.
- A imagem da IA nunca é referenciada pela URL do provedor; o projeto guarda `storagePath` e as URLs assinadas são renovadas ao reabrir.
- Exclusão lógica; o arquivo só é removido se não estiver em nenhuma versão do conteúdo nem em conteúdo em revisão/aprovado/publicado.
- Cancelamento só é marcado quando o provedor confirma (HTTP 202). Interrupção do acompanhamento no navegador é informada como tal.

## 5. Testes

- `tests/ai-generation.test.ts` (30 casos, provedor simulado, sem consumo de créditos): catálogo, capacidades, prompts, envio, acompanhamento, conclusão e armazenamento, falha de API, falha de Storage com recuperação, usuário não autorizado, cota, referência bloqueada, cancelamento, SSRF, contrato HTTP do fal.ai.
- `supabase/tests/sprint_5_ai_generation.sql`: grants, cota atômica, modelo desabilitado, RLS entre usuários, permissão administrativa e auditoria.
- Teste com API real: **não executado** (sem credencial). Procedimento: configurar `FAL_KEY`, habilitar apenas FLUX.1 [schnell], definir cota 3 para o usuário de teste e gerar 1 imagem 1:1 padrão (≈US$ 0,003).

## 6. Pendências para operação

1. Criar a chave em fal.ai (Dashboard › Keys), com limite de gasto na conta, e cadastrar `FAL_KEY` no Railway.
2. Confirmar `SUPABASE_SERVICE_ROLE_KEY` no Railway.
3. Aplicar a migração da Sprint 5 no projeto Supabase.
4. Validar termos de uso/retenção de dados do fal.ai com Segurança da Informação.
5. Executar o teste real controlado e o fluxo completo: gerar → usar como fundo → salvar → reabrir.
6. Revisar os custos de referência em `/administracao/ia` conforme a tabela vigente do fal.ai.
