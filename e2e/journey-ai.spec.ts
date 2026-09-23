import { expect, test } from "@playwright/test";
import { loginAs, sql, unique, users } from "./helpers";
import { createCommunique, openEditorAndPersist, waitSaved } from "./journeys";

/**
 * Jornada de IA com o provedor SIMULADO (scripts/e2e/mock-fal.mjs), que reproduz o contrato da Queue API
 * da fal.ai. Valida o fluxo da aplicação, não a disponibilidade do provedor real.
 */
test("geração com IA (mock): solicitar, acompanhar, visualizar, inserir, salvar e reabrir", async ({ page }) => {
  await loginAs(page, users.editor);
  const contentId = await createCommunique(page, unique("IA E2E"));
  await openEditorAndPersist(page, contentId, sql);
  const before = Number(sql(`select jsonb_array_length(snapshot->'elements') from content_versions where content_id='${contentId}' and version_kind='working'`));

  await page.getByRole("tab", { name: "Geração com IA" }).click();
  await page.getByPlaceholder(/ambiente corporativo moderno/).fill("Escritório contábil moderno com painéis de indicadores em tons de azul");
  await page.getByRole("button", { name: "Gerar imagem" }).click();

  // Job registrado, processado pelo provedor simulado e imagem armazenada.
  const image = page.getByRole("img", { name: "Imagem gerada por IA" }).first();
  await expect(image).toBeVisible({ timeout: 45_000 });
  const job = sql(`select status || '|' || provider || '|' || coalesce(external_request_id,'') || '|' || image_count from generation_jobs where content_id='${contentId}'`);
  console.log(`job: ${job}`);
  expect(job).toMatch(/^completed\|fal\|e2e-\d+\|1$/);
  expect(sql(`select source || '|' || mime_type || '|' || width || 'x' || height || '|' || (storage_path like '${contentId}%' or storage_path like '%/${contentId}/%') from media_assets where content_id='${contentId}' and generation_job_id is not null`))
    .toMatch(/^ai_generation\|image\/(png|webp)\|512x288\|true$/);
  // Prompt não é exposto nos logs de auditoria (apenas metadados).
  expect(sql(`select count(*) from audit_logs where entity_type='generation_jobs' and metadata::text ilike '%painéis de indicadores%'`)).toBe("0");

  // Visualizar e inserir na composição.
  await page.getByRole("button", { name: "Visualizar" }).first().click();
  await expect(page.getByRole("img", { name: "Imagem gerada por IA ampliada" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Inserir na composição" }).click();
  await expect.poll(() => Number(sql(`select jsonb_array_length(snapshot->'elements') from content_versions where content_id='${contentId}' and version_kind='working'`)), { timeout: 20_000 }).toBe(before + 1);
  await waitSaved(page);
  // O snapshot guarda o caminho no storage (não a URL assinada temporária).
  expect(sql(`select count(*) from content_versions v, jsonb_array_elements(v.snapshot->'elements') e where v.content_id='${contentId}' and v.version_kind='working' and e->>'storagePath' is not null`)).toBe("1");

  // Reabrir: imagem presente e carregada com nova URL assinada.
  await page.reload();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Camadas" }).click();
  await expect(page.getByText(/\.(png|webp)/).first()).toBeVisible();
});

test("autorização da geração: aprovador e editor de outro conteúdo são recusados sem criar job", async ({ page }) => {
  // Conteúdo pertencente ao administrador.
  await loginAs(page, users.admin);
  const foreign = await createCommunique(page, unique("Conteúdo alheio IA"));
  const payload = { contentId: foreign, modelId: "fal-ai/flux/schnell", prompt: "Painel financeiro corporativo em tons de azul", imageCount: 1 };
  const jobs = () => sql(`select count(*) from generation_jobs where content_id='${foreign}'`);

  await loginAs(page, users.approver);
  const approver = await page.request.post("/api/ai/generations", { data: payload });
  expect(approver.status()).toBe(403);

  await loginAs(page, users.editor);
  const editor = await page.request.post("/api/ai/generations", { data: payload });
  expect([403, 404]).toContain(editor.status());
  console.log(`aprovador=${approver.status()} editor-alheio=${editor.status()}`);
  expect(jobs()).toBe("0");
});
