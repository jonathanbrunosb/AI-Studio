import { expect, test } from "@playwright/test";
import { loginAs, sql, unique, userId, users, writeAsUser } from "./helpers";
import { createCommunique } from "./journeys";

const adminPages = ["/administracao", "/administracao/ia", "/administracao/identidade", "/administracao/integracoes"];

for (const [label, email] of [["editor", users.editor], ["aprovador", users.approver]] as const) {
  test(`${label} não acessa páginas administrativas`, async ({ page }) => {
    await loginAs(page, email);
    for (const path of adminPages) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/dashboard\?access=denied/);
    }
    await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(0);
  });
}

test("escalonamento de privilégio pelo banco é bloqueado para editor", () => {
  const editor = userId(users.editor);
  const approver = userId(users.approver);
  const attempts: Record<string, string> = {
    "atribuir papel admin a si": `insert into user_roles(user_id, role) values ('${editor}', 'admin')`,
    "remover papel de outro": `delete from user_roles where user_id='${approver}'`,
    "desativar outro usuário": `update profiles set is_active=false where id='${approver}'`,
    "alterar configuração de IA": `update ai_settings set default_max_requests=9999`,
    "ampliar a própria cota": `insert into ai_user_limits(user_id, max_requests) values ('${editor}', 9999)`,
    "criar cliente de integração": `insert into integration_clients(name, token_hash, token_prefix) values ('x', repeat('a',64), 'ais_x')`,
    "alterar destino do portal": `update portal_destinations set enabled=false`,
    "apagar trilha de auditoria": `delete from audit_logs`,
    "forjar registro de auditoria": `insert into audit_logs(actor_id, action, entity_type) values ('${approver}', 'forjado', 'x')`,
  };
  const results = Object.fromEntries(Object.entries(attempts).map(([name, dml]) => [name, writeAsUser(users.editor, dml)]));
  console.log(JSON.stringify(results));
  for (const [name, result] of Object.entries(results)) expect(result, name).toBe("blocked");
});

test("editor não acessa rascunho nem imagem de outro usuário", async ({ page }) => {
  await loginAs(page, users.admin);
  const foreign = await createCommunique(page, unique("Rascunho do admin"));
  const adminId = userId(users.admin);
  // Imagem fictícia do administrador (fixture direta no banco de teste).
  const assetId = sql(`insert into media_assets(content_id, storage_path, file_name, mime_type, created_by, bucket, source)
    values ('${foreign}', '${adminId}/${foreign}/fixture.png', 'fixture.png', 'image/png', '${adminId}', 'editor-assets', 'upload') returning id`).split("\n")[0];

  await loginAs(page, users.editor);
  expect(sql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${userId(users.editor)}', true); select count(*) from contents where id='${foreign}'; rollback;`).split("\n").find((line) => /^\d+$/.test(line))).toBe("0");
  // Páginas de conteúdo alheio: sem dados do rascunho (resposta de "não encontrado").
  for (const path of [`/studio?id=${foreign}`, `/studio/editor/${foreign}`, `/gestao-editorial/revisao/${foreign}`]) {
    const body = await (await page.request.get(path)).text();
    expect(body, path).not.toContain("Rascunho do admin");
  }
  expect(await (await page.request.get(`/studio/editor/${foreign}`)).text()).toContain("Página não encontrada");

  const remove = await page.request.delete(`/api/ai/assets/${assetId}`);
  expect([403, 404]).toContain(remove.status());
  expect(sql(`select deleted_at is null from media_assets where id='${assetId}'`)).toBe("t");
  expect(writeAsUser(users.editor, `update media_assets set deleted_at=now() where id='${assetId}'`)).toBe("blocked");
});

test("usuário desativado perde o acesso mesmo com sessão ativa", async ({ page }) => {
  await loginAs(page, users.editor);
  const editor = userId(users.editor);
  try {
    sql(`update profiles set is_active=false where id='${editor}'`);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    const api = await page.request.get("/api/ai/generations?contentId=00000000-0000-0000-0000-000000000000");
    expect(api.status()).toBe(401);
  } finally {
    sql(`update profiles set is_active=true where id='${editor}'`);
  }
});

test("rota de encerramento de sessão não desloga usuário ativo (CSRF de logout)", async ({ page }) => {
  await loginAs(page, users.editor);
  await page.goto("/auth/signout?reason=inactive");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/biblioteca");
  await expect(page).toHaveURL(/\/biblioteca/);
});
