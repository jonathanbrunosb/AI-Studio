import { expect, test } from "@playwright/test";
import { loginAs, sql, unique, users } from "./helpers";
import { createCommunique, openEditor, waitSaved } from "./journeys";

test("editor cria comunicado, personaliza a composição, salva e reabre com persistência", async ({ page }) => {
  await loginAs(page, users.editor);
  const title = unique("Comunicado E2E");
  const contentId = await createCommunique(page, title);

  await page.getByRole("link", { name: "Abrir editor visual" }).click();
  await expect(page).toHaveURL(new RegExp(`/studio/editor/${contentId}`));
  await waitSaved(page);
  const before = Number(sql(`select coalesce(jsonb_array_length(snapshot->'elements'),0) from content_versions where content_id='${contentId}' and version_kind='working'`) || 0);

  await page.getByRole("button", { name: "Elementos" }).click();
  await page.getByRole("button", { name: "Retângulo" }).click();
  await page.getByRole("button", { name: "Texto", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar subtítulo" }).click();
  // Salvamento automático (debounce de 1,8 s) grava os dois novos elementos.
  await expect.poll(() => Number(sql(`select jsonb_array_length(snapshot->'elements') from content_versions where content_id='${contentId}' and version_kind='working'`)), { timeout: 20_000 }).toBe(before + 2);
  await waitSaved(page);
  console.log(`elementos antes=${before} depois=${before + 2}`);
  expect(sql(`select snapshot->'canvas'->>'width' || 'x' || (snapshot->'canvas'->>'height') from content_versions where content_id='${contentId}' and version_kind='working'`)).toBe("1080x1080");

  // Reabrir: composição e dados editoriais preservados.
  await openEditor(page, contentId);
  await page.getByRole("button", { name: "Camadas" }).click();
  await expect(page.getByText("Retângulo").first()).toBeVisible();
  await page.goto(`/studio?id=${contentId}`);
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(title);
  await expect(page.getByLabel("Subtítulo", { exact: true })).toHaveValue("Orientações do fechamento mensal");

  // Checkpoint manual gera versão no histórico.
  await openEditor(page, contentId);
  await waitSaved(page);
  await page.getByRole("button", { name: "Salvar versão" }).click();
  await expect.poll(() => sql(`select count(*) from content_versions where content_id='${contentId}' and version_kind='checkpoint'`)).toBe("1");
  expect(sql(`select count(*) from audit_logs where entity_type='contents' and entity_id='${contentId}' and action='content.created'`)).toBe("1");
});

test("aprovador não pode criar conteúdo", async ({ page }) => {
  await loginAs(page, users.approver);
  await page.goto("/studio");
  await expect(page.getByText("A criação exige acesso editorial")).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar conteúdo" })).toHaveCount(0);
});
