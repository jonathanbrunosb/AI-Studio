# Sprint 7 — Integração com o Portal da Contabilidade

## 1. Diagnóstico dos repositórios

| Item | AI Studio | Portal da Contabilidade (`jonathanbrunosb/portal-contabilidade`) |
|---|---|---|
| Arquitetura | Next.js + Supabase (Railway) | HTML/CSS/JS puro, publicado no **GitHub Pages**; dados em `data/*.json` |
| Backend | Server Actions / Route Handlers | `server/server.js` **opcional e local** (Node sem dependências), token compartilhado `PORTAL_ADMIN_TOKEN` |
| Autenticação | Supabase Auth + RLS | Não há: identificação por seleção de nome (`localStorage`) e código de desbloqueio da Administração |
| Newsletter / comunicados | — | Coleção `newsletter` (Newsletter Contábil) com categoria "Comunicado Interno"; `noticias` (Notícias & Impactos). **Não existe** aba própria de Comunicados Internos nem de anúncios de sistemas (`sistemas` é catálogo de acessos) |
| Publicação no portal | — | Painel Editorial: `Rascunho → Em revisão → Publicado` (exige `aprovadoPor`) — só com o backend opcional ligado; sem ele, edição manual dos JSON + commit |
| Imagens | Supabase Storage privado | Arquivos estáticos em `assets/` |
| `publication_exports` | Tabela prevista (sem uso) | — |

**Conclusão:** o portal publicado não tem um backend capaz de proteger credenciais. Por isso a integração servidor-servidor **não foi ligada**: a API do AI Studio está implementada e testada com mocks, mas desabilitada por padrão. O fluxo operacional é **exportação ZIP assinada + importação administrativa no portal + confirmação manual no AI Studio**.

## 2. Fluxo operacional

1. **AI Studio → Central de Publicações → Preparar publicação.** Somente autor (editor) ou administrador; somente a versão aprovada vigente (`contents.approved_version_id`, versão `frozen`). A peça é renderizada no navegador a partir do snapshot aprovado e validada no servidor (PNG, dimensões exatas). Manifesto, hashes e ZIP são gerados no servidor e guardados no bucket privado `publication-packages`.
2. **Baixar ZIP** (rota autenticada; confere o SHA-256 do pacote armazenado; registra `exported`).
3. **Portal → Administração → Importar do AI Studio.** Valida ZIP (nomes, quantidade, tamanhos, CRC), `manifest.json`, hashes SHA-256 e assinatura ECDSA; mostra a pré-visualização; exige confirmação manual da origem quando a chave pública não está configurada. O item entra como **Em revisão** — nunca publicado automaticamente.
   - Com backend opcional: imagem vai para `assets/images/ai-studio/` (somente PNG) e o item é gravado via API; importar a mesma versão duas vezes é recusado (409).
   - Sem backend (GitHub Pages): o portal gera `newsletter.json` atualizado + a imagem para commit.
4. **Portal → Painel Editorial → Aprovar e publicar.** Se o item substitui uma versão anterior do mesmo conteúdo, a anterior passa a "Substituído" somente neste momento.
5. **AI Studio → Confirmar publicação** (administrador): canal, data, identificador (`ais-xxxxxxxx-vN`) e link. A publicação anterior do conteúdo vira `superseded`; o conteúdo passa a `published`.

## 3. Pacote

```
<titulo>-v<N>.zip
├── manifest.json        # schema_version 1.0 (campos abaixo)
├── <titulo>-v<N>.png    # peça aprovada, resolução lógica
├── checksums.sha256     # SHA-256 do manifesto e da imagem
├── README.txt           # instruções de importação
└── manifest.sig         # assinatura ECDSA P-256/SHA-256 do manifest.json (quando configurada)
```

Campos do manifesto: `schema_version`, `publication_id`, `content_id`, `version_id`, `title`, `subtitle`, `summary`, `description`, `category`, `category_label`, `destination{id,label,portal_collection,portal_category}`, `reference_date`, `source_name`, `source_url`, `access_url`, `system_name`, `functionality`, `institutional_owner`, `image{filename,width,height,format,bytes,sha256}`, `approval{version_id,version_number,approved_at,snapshot_sha256}`, `supersedes`, `prepared_at`. Todos os dados vêm da versão aprovada congelada. Não há tokens, URLs assinadas, e-mails ou nomes de usuários; URLs não HTTP(S) são descartadas.

**Integridade × origem:** o hash comprova que os arquivos não mudaram; a assinatura (chave privada só no servidor do AI Studio, chave pública no `data/config.json` do portal) comprova a origem. Nenhum dos dois substitui a revisão final.

## 4. Banco de dados (migração `20260923120000_sprint_7_publications.sql`)

- `portal_destinations`, `content_category_destinations` (mapeamento, 1 padrão por categoria), `portal_integration_settings` (singleton), `integration_clients` (hash SHA-256 do token, escopos, revogação).
- `publication_exports` ampliada: `version_id`, `destination`, `status` (`prepared/exported/received/pending_publication/published/failed/superseded`), manifesto e hashes, `signed`, datas, `external_publication_id`, `external_url`, `published_channel`, `confirmed_by`, `confirmation_source`, `error_message`, `supersedes_id`, `superseded_by_id`. Índice único: **uma publicação ativa por versão + destino**.
- `publication_events`: histórico (append-only) de todas as transições, incluindo confirmações repetidas.
- View `publication_latest` (`security_invoker`): publicação mais recente por conteúdo, usada nos indicadores sem contar tentativas repetidas.
- Funções: `register_publication_package` (somente backend), `transition_publication` (usuário: exportado; admin: confirmar, aguardando, falha, nova tentativa), `portal_acknowledge_publication` (somente backend, idempotente), `create_new_content_version` agora também a partir de conteúdo publicado.
- Bucket privado `publication-packages`.

`contents.status` (editorial) e `publication_exports.status` (publicação) são independentes: exportar não altera o status editorial; o conteúdo só vira `published` com a confirmação.

## 5. API de integração (pronta, desabilitada)

| Endpoint | Método | Escopo |
|---|---|---|
| `/api/integrations/portal/v1/publications?status=&page=&page_size=` | GET | `publications:read` |
| `/api/integrations/portal/v1/publications/{id}` | GET | `publications:read` |
| `/api/integrations/portal/v1/publications/{id}/assets` | GET — URLs temporárias (5 min) | `publications:read` |
| `/api/integrations/portal/v1/publications/{id}/acknowledge` | POST | `publications:ack` |

- `Authorization: Bearer ais_…` (token criado em Administração → Integrações, exibido uma vez; só o hash é salvo).
- Respostas `{"api_version":"2026-09-v1", ...}`; erros `{"error":{"code","message"}}`; 60 req/min por cliente (memória — mover para Redis/DB se houver réplicas).
- `acknowledge`: corpo `{content_id, version_id, status: received|pending_publication|published|failed, external_publication_id?, external_url?, published_at?, message?}`. Idempotente: repetição retorna `duplicate: true` e preserva a confirmação original; conteúdo/versão divergentes → 409.
- Integração desabilitada → 503. Toda chamada gera `audit_logs`.

**Para ligar** é preciso um backend do portal acessível e seguro (por exemplo, `server/server.js` hospedado em rede interna com HTTPS, guardando o token em variável de ambiente) que consuma `publications`, importe usando o mesmo módulo `js/ai-studio-import.js` e chame `acknowledge`. Esse adaptador **não foi implementado** e a sincronização automática **não foi testada** entre as aplicações.

## 6. Configuração

| Onde | O quê |
|---|---|
| AI Studio (Railway) | `PORTAL_SIGNING_PRIVATE_KEY` (ECDSA P-256 PKCS#8 PEM). Gerar: `openssl ecparam -name prime256v1 -genkey -noout \| openssl pkcs8 -topk8 -nocrypt` |
| Portal `data/config.json` | `aiStudio.publicKeySpki` = chave pública exibida em Administração → Integrações; depois `aiStudio.requireSignature: true` |
| Portal (opcional) | `PORTAL_ASSETS_CONTENT_DIR` para mudar a pasta de imagens importadas |

## 7. Testes

- `supabase/tests/sprint_7_publications.sql`: rascunho bloqueado, versão de trabalho e versão desatualizada bloqueadas, destino incompatível, aprovador sem permissão, preparação duplicada sem novo registro, exportação sem alterar status editorial, confirmação só por admin e com dados, reconfirmação preserva o original, ack duplicado idempotente, ack divergente recusado, nova versão a partir de publicado, substituição somente após confirmação, falha → nova tentativa → confirmação via API.
- `tests/publication-package.test.ts`: manifesto, ZIP/CRC/hashes, assinatura e **interoperabilidade real** com o código do portal (importação válida, adulteração, assinatura de outra chave, pacote sem assinatura, arquivo inesperado). Gera a fixture usada pelo portal.
- `tests/portal-integration-api.test.ts`: autenticação, revogação, integração desabilitada, escopo, contrato, URLs temporárias, validação e idempotência do ack, rate limit, regras de permissão.
- Portal `tests/ai-studio-import.test.mjs` (`node --test tests/*.test.mjs`): pacote válido/verificado, origem não verificável, adulteração, nomes com caminho, manifesto malicioso, duplicidade/substituição e backend opcional (token, PNG obrigatório, path traversal, 409 em reimportação).
- Navegador (Playwright, portal estático): upload do ZIP, pré-visualização, confirmação manual de origem e geração de `newsletter.json` + imagem, sem erros de console.

## 8. Pendências para implantação

1. Aplicar as migrações das Sprints 5, 6 e 7 no Supabase.
2. Gerar e cadastrar `PORTAL_SIGNING_PRIVATE_KEY`; copiar a chave pública para o portal e ativar `requireSignature`.
3. Teste ponta a ponta com dados reais: preparar no AI Studio → importar no portal → publicar → confirmar.
4. Decidir se o portal terá backend seguro hospedado; só então habilitar a API e implementar o adaptador (consumir + `acknowledge`).
5. Evolução do portal (opcional): aba própria para Comunicados Internos e para anúncios de sistemas — hoje ambos usam categorias da Newsletter.
6. A imagem da peça é renderizada no navegador de quem prepara (o servidor valida formato e dimensões e registra os hashes). Para eliminar essa confiança, adotar renderização no servidor (ex.: `canvas` + Fabric em Node).
