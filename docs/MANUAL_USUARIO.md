# Manual do usuário — AI Studio · Comunicação Contábil

As telas abaixo foram capturadas da aplicação real em ambiente de teste (23/09/2026), com **dados fictícios**.
A tela de IA (passo 6) usa o **provedor simulado** do ambiente de teste: a imagem exibida não foi gerada pela fal.ai.

## Perfis de acesso

| Perfil | Pode | Não pode |
|---|---|---|
| **Editor** | Criar e editar conteúdos próprios, usar o editor visual e a IA, enviar para aprovação, preparar e baixar pacotes de publicação | Aprovar, confirmar publicação, administrar |
| **Aprovador** | Revisar, aprovar ou devolver conteúdos de outros autores | Criar conteúdo, gerar imagens, aprovar o que ele mesmo enviou |
| **Administrador** | Tudo do editor, gerenciar usuários, IA, identidade visual e integrações, confirmar publicações | Aprovar conteúdo de sua própria autoria (segregação de funções) |

## 1. Entrar

![Tela de login](img/01-login.png)

Informe o e-mail corporativo e a senha. Em caso de esquecimento, use **Recuperar senha**: a resposta é sempre a mesma, por segurança, e o link chega por e-mail se a conta existir. Contas desativadas não acessam o sistema; se sua sessão for encerrada com o aviso de acesso indisponível, procure um administrador.

## 2. Dashboard

![Dashboard](img/02-dashboard.png)

Mostra seus indicadores (conteúdos, rascunhos, itens em revisão) e o atalho **Começar nova criação**.

## 3. Criar um conteúdo

![Escolha da categoria](img/03-escolher-categoria.png)

Clique em **Criar conteúdo** e escolha a categoria (Comunicado Interno, Newsletter Contábil, Divulgação de Sistemas, Campanha Interna).

![Dados editoriais](img/04-dados-editoriais.png)

Preencha título, subtítulo, texto principal e os campos da categoria. **Criar rascunho** salva o conteúdo; depois use **Abrir editor visual**.

**Newsletter Contábil, Divulgação de Sistemas e Campanha Interna** seguem o mesmo fluxo; cada categoria carrega o seu modelo corporativo e campos próprios (a Divulgação de Sistemas exige solução e funcionalidade). Os modelos podem ser consultados em **Modelos** e aplicados no editor pela aba **Templates**.

## 4. Editor visual

![Editor visual](img/05-editor-visual.png)

- **Esquerda**: modelos, textos, imagens, elementos e camadas.
- **Centro**: a peça, nos formatos Quadrado, Horizontal Full HD ou Vertical.
- **Direita**: propriedades do item selecionado e **Geração com IA**.
- O salvamento é automático; o indicador no topo mostra "Todas as alterações salvas". **Salvar versão** cria um marco no histórico. **Exportar** baixa PNG/JPG para uso interno.
- Use o editor em telas de pelo menos 1024 px. Em celulares, prefira apenas consultar.

## 5. (Opcional) Gerar imagem com IA

![Geração com IA — provedor simulado](img/06-geracao-ia-provedor-simulado.png)

Descreva a imagem (mínimo de 10 caracteres), escolha proporção e quantidade e clique em **Gerar imagem**. O custo estimado é exibido antes. Ao concluir, use **Inserir na composição** ou **Utilizar como fundo**.
Não inclua dados pessoais, financeiros ou informações internas sensíveis no texto do pedido nem em imagens de referência.

> A geração depende da chave do provedor configurada pelo administrador. Se estiver indisponível, o painel informa o motivo.

## 6. Enviar para aprovação

![Enviar para aprovação](img/07-enviar-para-aprovacao.png)

Clique em **Enviar para aprovação**, confira os dados e a pré-visualização, escolha um aprovador (ou a fila geral) e confirme. A partir daí a versão enviada fica bloqueada para edição.

## 7. Revisar (aprovador)

![Gestão Editorial](img/08-gestao-editorial.png)

Em **Gestão Editorial** estão os itens aguardando decisão.

![Revisão](img/09-revisao-aprovador.png)

- **Aprovar conteúdo**: bloqueia a versão e a libera para publicação.
- **Solicitar ajustes**: exige justificativa; o autor corrige e reenvia (novo ciclo).
- Você não verá os botões de decisão em conteúdos de sua autoria ou enviados por você.

## 8. Publicar

![Central de Publicações](img/10-central-publicacoes.png)

Na **Central de Publicações**, o autor clica em **Preparar publicação**.

![Preparar publicação](img/11-preparar-publicacao.png)

Confira os dados, marque a confirmação e clique em **Gerar pacote**; depois **Baixar pacote ZIP** e importe-o no Portal da Contabilidade. O portal verifica a integridade e a assinatura do pacote.
Após verificar a matéria publicada no portal, o **administrador** registra **Confirmar publicação**.

Para alterar um conteúdo já publicado, use **Criar nova versão**: a publicação atual continua valendo até a nova versão ser aprovada e confirmada.

## 9. Biblioteca e histórico

![Biblioteca](img/13-biblioteca.png)

A **Biblioteca** lista seus materiais com busca por título, filtros (categoria, status, coleção, autoria), ordenação e paginação. Materiais que você pode consultar, mas não editar, abrem em modo de leitura.

![Histórico](img/14-historico.png)

O **Histórico editorial** de cada conteúdo mostra envios, decisões, justificativas e versões, com autor e data. O histórico de publicação fica em **Central de Publicações → Histórico**.

## 10. Administração

![Administração](img/12-administracao.png)

Gerenciamento de usuários e papéis, configuração da IA (modelos, cotas), identidade visual e integrações com o Portal. Todas as ações ficam registradas na trilha de auditoria.

## Dúvidas frequentes

- **"Alterações não salvas" não some**: verifique a conexão; se aparecer a mensagem de erro, use **Tentar novamente** antes de sair da página.
- **Não encontro o botão Aprovar**: você é autor ou remetente do conteúdo, ou não tem o perfil de aprovador.
- **O pacote foi recusado no portal**: gere novamente (**Regerar pacote**) e não altere o arquivo ZIP.
