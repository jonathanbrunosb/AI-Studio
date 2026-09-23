# Roteiro de homologação — AI Studio (Sprint 8)

**Ambiente:** homologação (Railway + projeto Supabase de homologação) · **Dados:** fictícios ou anonimizados
**Participantes mínimos:** 3 pessoas distintas — Editor (E), Aprovador (A) e Administrador (Adm).
**Não usar uma única conta para simular a segregação entre elaboração e aprovação.**
**Status:** preencher somente durante a execução — `Aprovado` / `Reprovado` / `Não executado`, com a evidência (captura, id do registro, horário).

## Etapas

| # | Validação | Perfil | Como executar | Resultado esperado | Status | Evidência |
|---|---|---|---|---|---|---|
| 1 | Acessar o AI Studio com usuário autorizado | E, A, Adm | Login de cada participante | Acesso ao dashboard conforme o papel | | |
| 2 | Criar um comunicado interno | E | Criar conteúdo → Comunicado Interno → preencher → Criar rascunho | Conteúdo salvo, visível na Biblioteca | | |
| 3 | Selecionar um template | E | Editor → Templates → aplicar um modelo | Composição com a identidade corporativa aplicada | | |
| 4 | Personalizar o conteúdo no editor | E | Alterar textos, cores, adicionar forma/imagem | Alterações visíveis; indicador "Todas as alterações salvas" | | |
| 5 | Gerar e inserir uma imagem com IA | E | Geração com IA → prompt neutro → Gerar → Inserir na composição | Imagem gerada **pela fal.ai** e inserida (primeira comprovação real da integração; custo estimado exibido antes) | | id do job |
| 6 | Salvar e reabrir o projeto | E | Salvar versão → sair → reabrir | Composição idêntica; versão listada no Histórico | | |
| 7 | Encaminhar o conteúdo para aprovação | E | Enviar para aprovação → escolher o Aprovador → confirmar | Status "Em revisão"; edição bloqueada | | |
| 8 | Solicitar ajustes utilizando outro usuário | A | Gestão Editorial → revisão → Solicitar ajustes com justificativa | Status "Ajustes solicitados"; justificativa registrada | | |
| 9 | Corrigir e reenviar o material | E | Ajustar a peça → reenviar | Novo ciclo de revisão | | |
| 10 | Aprovar a versão final | A | Aprovar conteúdo → Confirmar | Status "Aprovado"; versão bloqueada | | |
| 11 | Preparar o pacote de publicação | E | Central de Publicações → Preparar publicação → Gerar pacote | Pacote gerado com a versão aprovada | | |
| 12 | Exportar o material para o portal | E | Baixar pacote ZIP | ZIP com manifesto, PNG, checksums e assinatura; status "Exportado" | | |
| 13 | Importar o conteúdo no Portal da Contabilidade, quando disponível | Adm do Portal | Administração do Portal → Importar do AI Studio | Pacote aceito com origem verificada | | |
| 14 | Confirmar a publicação | Adm | Confirmar publicação (canal, data, identificador) | Status "Publicado" | | |
| 15 | Consultar o histórico completo das operações | Adm | Histórico editorial e de publicação do conteúdo; auditoria | Todas as etapas registradas com autor, data e versão | | |

## Verificações complementares de segurança (recomendadas)

| # | Verificação | Resultado esperado | Status | Evidência |
|---|---|---|---|---|
| C1 | Editor e Aprovador tentam abrir `/administracao` | Redirecionados com acesso negado | | |
| C2 | Adm cria e envia um conteúdo e tenta aprová-lo | Decisão indisponível (segregação de funções) | | |
| C3 | Adm desativa uma conta de teste com sessão aberta | Sessão encerrada com aviso; novo login recusado | | |
| C4 | Alterar 1 byte do ZIP e importar no Portal | Pacote recusado | | |
| C5 | Abrir dashboard e publicações em celular (~390 px) | Telas utilizáveis, sem rolagem horizontal | | |

## Critérios de aceite

- Etapas 1–4, 6–12, 14 e 15 aprovadas: fluxo essencial homologado.
- Etapa 5 aprovada: integração com IA comprovada. Se não executada, a IA deve permanecer **desabilitada** em produção.
- Etapa 13 aprovada: integração com o Portal comprovada entre as aplicações reais.
- Reprovação em 1, 7, 8, 10 ou C1–C3 bloqueia a implantação.

## Assinaturas

| Papel | Nome | Data | Resultado |
|---|---|---|---|
| Responsável pelo projeto | | | |
| Responsável técnico | | | |
