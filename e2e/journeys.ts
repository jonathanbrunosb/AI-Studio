import { expect, type Page } from "@playwright/test";

/** Cria um comunicado pelo fluxo real da interface e retorna o id do conteúdo. */
export async function createCommunique(page: Page, title: string) {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Criar conteúdo" }).first().click();
  await page.getByRole("link", { name: /Comunicado Interno/ }).click();
  await expect(page.getByText("Modelo: Comunicado Corporativo")).toBeVisible();
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByLabel("Subtítulo", { exact: true }).fill("Orientações do fechamento mensal");
  await page.getByLabel("Texto principal").fill("Confira os prazos e responsáveis do fechamento contábil.");
  await page.getByRole("button", { name: "Criar rascunho" }).click();
  await expect(page).toHaveURL(/\/studio\?id=[0-9a-f-]{36}&saved=1/);
  return new URL(page.url()).searchParams.get("id")!;
}

export async function openEditor(page: Page, contentId: string) {
  await page.goto(`/studio/editor/${contentId}`);
  await expect(page.locator("canvas").first()).toBeVisible();
}

export async function waitSaved(page: Page) {
  await expect(page.getByText("Todas as alterações salvas")).toBeVisible({ timeout: 20_000 });
}

export async function layerNames(page: Page) {
  await page.getByRole("button", { name: "Camadas" }).click();
  return page.locator("aside .rounded-xl.border").allInnerTexts();
}

/** Abre o editor e aguarda a primeira gravação da composição inicial no banco (salvamento automático). */
export async function openEditorAndPersist(page: Page, contentId: string, sqlQuery: (query: string) => string) {
  await openEditor(page, contentId);
  await expect.poll(() => sqlQuery(`select count(*) from content_versions where content_id='${contentId}' and version_kind='working'`), { timeout: 20_000 }).toBe("1");
  await waitSaved(page);
}
