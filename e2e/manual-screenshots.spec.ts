import { expect, test, type Page } from "@playwright/test";
import { loginAs, sql, users } from "./helpers";
import { approveAsReviewer, createCommunique, openEditorAndPersist, submitForReview } from "./journeys";

/**
 * Capturas reais para docs/MANUAL_USUARIO.md (1366x768, dados fictícios do ambiente de teste).
 * A geração com IA usa o provedor SIMULADO: a imagem da tela de IA não é resultado da fal.ai.
 */
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/manual/img/${name}.png` });

test("capturas do manual do usuário", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/login");
  await shot(page, "01-login");

  await loginAs(page, users.editor);
  await shot(page, "02-dashboard");
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Criar conteúdo" }).first().click();
  await shot(page, "03-escolher-categoria");

  const contentId = await createCommunique(page, "Calendário de fechamento — outubro");
  await shot(page, "04-dados-editoriais");
  await openEditorAndPersist(page, contentId, sql);
  await shot(page, "05-editor-visual");

  await page.getByRole("tab", { name: "Geração com IA" }).click();
  await page.getByPlaceholder(/ambiente corporativo moderno/).fill("Escritório contábil moderno com calendário e painéis de indicadores em tons de azul");
  await page.getByRole("button", { name: "Gerar imagem" }).click();
  await expect(page.getByRole("img", { name: "Imagem gerada por IA" }).first()).toBeVisible({ timeout: 45_000 });
  await shot(page, "06-geracao-ia-provedor-simulado");

  await page.goto(`/studio?id=${contentId}&submit=1`);
  await expect(page.getByRole("dialog", { name: "Enviar para aprovação" }).getByRole("option", { name: "Aprovador E2E" })).toBeAttached();
  await shot(page, "07-enviar-para-aprovacao");
  await submitForReview(page, contentId, sql);

  await loginAs(page, users.approver);
  await page.goto("/gestao-editorial");
  await shot(page, "08-gestao-editorial");
  await page.goto(`/gestao-editorial/revisao/${contentId}`);
  await shot(page, "09-revisao-aprovador");
  await approveAsReviewer(page, contentId, sql);

  await loginAs(page, users.editor);
  await page.goto("/publicacoes");
  await shot(page, "10-central-publicacoes");
  await page.getByRole("row").filter({ hasText: "Calendário de fechamento — outubro" }).first().getByRole("button", { name: "Preparar publicação" }).click();
  await shot(page, "11-preparar-publicacao");

  await loginAs(page, users.admin);
  await page.goto("/administracao");
  await shot(page, "12-administracao");
});
