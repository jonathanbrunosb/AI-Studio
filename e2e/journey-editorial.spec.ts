import { expect, test, type Page } from "@playwright/test";
import { loginAs, sql, sqlAsUser, unique, users, writeAsUser } from "./helpers";
import { createCommunique, openEditor, openEditorAndPersist, submitForReview as submitWith, waitSaved } from "./journeys";

const submitForReview = (page: Page, contentId: string) => submitWith(page, contentId, sql);

const status = (id: string) => sql(`select status from contents where id='${id}'`);

test("fluxo editorial completo: envio, ajustes, reenvio, aprovação e bloqueio da versão", async ({ page }) => {
  // 1. Autor cria, edita (salvamento automático) e envia.
  await loginAs(page, users.editor);
  const contentId = await createCommunique(page, unique("Fluxo editorial E2E"));
  await openEditorAndPersist(page, contentId, sql);
  await submitForReview(page, contentId);

  // Em revisão, o editor não abre mais o editor visual e não altera a versão nem pelo banco.
  await page.goto(`/studio/editor/${contentId}`);
  await expect(page).toHaveURL(new RegExp(`/studio\\?id=${contentId}`));
  expect(writeAsUser(users.editor, `update content_versions set label='x' where content_id='${contentId}'`)).toBe("blocked");
  expect(writeAsUser(users.editor, `update contents set title='alterado' where id='${contentId}'`)).toBe("blocked");

  // 2. Aprovador solicita ajustes com justificativa obrigatória.
  await loginAs(page, users.approver);
  await page.goto(`/gestao-editorial/revisao/${contentId}`);
  await page.getByRole("button", { name: "Solicitar ajustes" }).click();
  const back = page.getByRole("button", { name: "Devolver ao autor" });
  await expect(back).toBeDisabled();
  await page.getByLabel("Justificativa (obrigatória)").fill("Revisar a fonte e ajustar o destaque visual.");
  await back.click();
  await expect.poll(() => status(contentId)).toBe("changes_requested");

  // 3. Autor ajusta e reenvia (novo ciclo).
  await loginAs(page, users.editor);
  await openEditor(page, contentId);
  await waitSaved(page);
  await page.getByRole("button", { name: "Elementos" }).click();
  await page.getByRole("button", { name: "Retângulo" }).click();
  await expect.poll(() => Number(sql(`select jsonb_array_length(snapshot->'elements') from content_versions where content_id='${contentId}' and version_kind='working'`)), { timeout: 20_000 }).toBe(6);
  await waitSaved(page);
  await submitForReview(page, contentId);

  // 4. Aprovador aprova.
  await loginAs(page, users.approver);
  await page.goto(`/gestao-editorial/revisao/${contentId}`);
  await page.getByRole("button", { name: "Aprovar conteúdo" }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect.poll(() => status(contentId)).toBe("approved");

  // Trilha: 2 envios, 1 devolução e 1 aprovação, com os atores corretos.
  expect(sql(`select string_agg(e.action || ':' || split_part(u.email,'@',1), ',' order by e.created_at) from approval_events e join auth.users u on u.id=e.actor_id where content_id='${contentId}'`))
    .toBe("submitted:editor,changes_requested:aprovador,submitted:editor,approved:aprovador");
  // A versão aprovada é a do segundo ciclo e contém a alteração.
  expect(sql(`select jsonb_array_length(v.snapshot->'elements') from contents c join content_versions v on v.id=c.approved_version_id where c.id='${contentId}'`)).toBe("6");

  // 5. Versão aprovada bloqueada: interface redireciona e o banco rejeita escrita direta.
  await loginAs(page, users.editor);
  await page.goto(`/studio/editor/${contentId}`);
  await expect(page).toHaveURL(new RegExp(`/studio\\?id=${contentId}`));
  expect(writeAsUser(users.editor, `update content_versions set snapshot='{}' where content_id='${contentId}'`)).toBe("blocked");
  expect(writeAsUser(users.editor, `update contents set status='draft' where id='${contentId}'`)).toBe("blocked");
  expect(writeAsUser(users.editor, `delete from approval_events where content_id='${contentId}'`)).toBe("blocked");
  expect(status(contentId)).toBe("approved");
});

test("segregação: administrador com papel de editor não aprova o próprio conteúdo", async ({ page }) => {
  await loginAs(page, users.admin);
  const contentId = await createCommunique(page, unique("Autoaprovação E2E"));
  await openEditorAndPersist(page, contentId, sql);
  await submitForReview(page, contentId);

  await page.goto(`/gestao-editorial/revisao/${contentId}`);
  await expect(page.getByText("Segregação de funções: você não pode decidir")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar conteúdo" })).toHaveCount(0);
  // Mesmo chamando a função do banco diretamente, a aprovação é recusada.
  const attempt = sqlAsUser(users.admin, `select decide_content_review('${contentId}', (select submitted_version_id from contents where id='${contentId}'), 'approved')`);
  expect(attempt).not.toBe("ok");
  console.log(`bloqueio no banco: ${attempt.split("\n")[0]}`);
  expect(status(contentId)).toBe("in_review");

  // Um aprovador distinto conclui a decisão.
  await loginAs(page, users.approver);
  await page.goto(`/gestao-editorial/revisao/${contentId}`);
  await page.getByRole("button", { name: "Aprovar conteúdo" }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect.poll(() => status(contentId)).toBe("approved");
});

test("editor não recebe controles de decisão na gestão editorial", async ({ page }) => {
  await loginAs(page, users.editor);
  await page.goto("/gestao-editorial");
  await expect(page.getByRole("button", { name: "Aprovar conteúdo" })).toHaveCount(0);
});
