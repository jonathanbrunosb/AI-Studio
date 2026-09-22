# Editor Visual Corporativo

## Decisão técnica

O editor utiliza Fabric.js 7.4.0. A biblioteca oferece seleção, transformação, edição de texto, agrupamento, serialização JSON e exportação raster em uma API consolidada. O Fabric é carregado apenas no módulo cliente do Estúdio; as páginas, autorização e consultas ao Supabase permanecem no servidor.

O projeto mantém dimensões lógicas independentes do zoom da interface. A visualização usa CSS para ajustar o canvas ao espaço disponível, enquanto PNG e JPG são gerados pelo canvas lógico com multiplicador 1. Assim, uma peça Full HD é exportada em 1920 × 1080 pixels mesmo quando aparece reduzida no navegador.

## Organização

- `src/components/studio/editor`: canvas, barras, ferramentas, propriedades, camadas, upload e exportação.
- `src/hooks/use-editor.ts`: ciclo de vida do Fabric e comandos do editor.
- `src/hooks/use-editor-history.ts`: histórico em memória de até 50 estados.
- `src/hooks/use-editor-persistence.ts`: fila, debounce de 1,8 segundo, recuperação de falha e proteção ao sair.
- `src/lib/editor`: contrato JSON, validação, serialização, exportação e consultas.
- `src/app/(protected)/studio/editor`: rota protegida e Server Action de persistência.

## Persistência e versões

Cada conteúdo possui no máximo uma versão `working`, atualizada pelo salvamento automático. O botão **Salvar versão** cria um `checkpoint` imutável e mantém a composição de trabalho. O JSON inclui canvas, fundo, elementos, propriedades, ordem, referência do template e snapshot do template no momento da criação.

O banco valida usuário ativo, papel de editor/administrador, autoria e status editorial. Somente conteúdos em `draft` ou `changes_requested` podem ser editados. Identidade, autoria, numeração e tipo das versões não podem ser modificados pelo cliente. O snapshot tem limite de 1 MiB e 250 elementos.

## Imagens

Arquivos PNG, JPG e WebP de até 10 MiB são enviados ao bucket privado `editor-assets`. O caminho começa pelo UUID do proprietário e as políticas do Storage validam essa convenção. As composições armazenam `storagePath`; URLs assinadas são renovadas ao reabrir o projeto. O arquivo é removido caso o registro de metadados falhe.

## Atalhos

- `Ctrl/Cmd + Z`: desfazer.
- `Ctrl/Cmd + Shift + Z` ou `Ctrl/Cmd + Y`: refazer.
- `Ctrl/Cmd + D`: duplicar.
- `Delete`/`Backspace`: excluir.

Os atalhos são ignorados durante digitação em campos da aplicação ou em caixas de texto do canvas.

## Limites deliberados

- A exportação é uma prévia de trabalho e recebe `-rascunho` no nome; não representa aprovação editorial.
- O histórico completo de aprovação e congelamento de versão será conectado na Sprint 6.
- Imagens geradas por IA poderão entrar pelo mesmo contrato de `media_assets` na Sprint 5.
- Fontes dependem das famílias instaladas no navegador. Calibri usa os fallbacks corporativos do design system.
