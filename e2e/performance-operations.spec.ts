import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginAs, sql, users } from "./helpers";
import { waitSaved } from "./journeys";

/**
 * Tempos de operação reais (mediana de 3 execuções) no ambiente local de teste.
 * Complementa docs/evidencias/desempenho.json; não representa latência do Railway/Supabase em nuvem.
 */
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return Math.round(sorted[Math.floor(sorted.length / 2)]); };

test("tempos de cadastro, abertura, salvamento, exportação e memória do editor", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAs(page, users.editor);
  const times: Record<string, number[]> = { cadastroMs: [], aberturaEditorMs: [], salvamentoVersaoMs: [], exportacaoPngMs: [] };
  const exportSizes: number[] = [];
  let heapMb = 0;

  for (let run = 0; run < 3; run += 1) {
    await page.goto("/studio?category=internal_communication");
    await page.getByLabel("Título", { exact: true }).fill(`Desempenho ${run} ${Date.now().toString(36)}`);
    await page.getByLabel("Texto principal").fill("Medição de desempenho do cadastro.");
    let start = Date.now();
    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(page).toHaveURL(/saved=1/);
    times.cadastroMs.push(Date.now() - start);
    const contentId = new URL(page.url()).searchParams.get("id")!;

    // Primeira abertura grava a composição inicial; a medição usa a segunda (projeto existente).
    await page.goto(`/studio/editor/${contentId}`);
    await expect.poll(() => sql(`select count(*) from content_versions where content_id='${contentId}' and version_kind='working'`), { timeout: 20_000 }).toBe("1");
    start = Date.now();
    await page.goto(`/studio/editor/${contentId}`);
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.getByRole("button", { name: "Camadas" }).click();
    await expect(page.getByText("Título").first()).toBeVisible();
    times.aberturaEditorMs.push(Date.now() - start);
    await waitSaved(page);

    start = Date.now();
    await page.getByRole("button", { name: "Salvar versão" }).click();
    await expect.poll(() => sql(`select count(*) from content_versions where content_id='${contentId}' and version_kind='checkpoint'`), { intervals: [50] }).toBe("1");
    times.salvamentoVersaoMs.push(Date.now() - start);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Exportar" }).click();
    start = Date.now();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("dialog", { name: "Exportar prévia" }).getByRole("button", { name: "Exportar PNG" }).click()]);
    const path = await download.path();
    times.exportacaoPngMs.push(Date.now() - start);
    const png = readFileSync(path);
    exportSizes.push(png.length);
    // Resolução final = dimensões lógicas da peça (cabeçalho IHDR), independentemente do zoom da tela.
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe("1080x1080");

    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");
    const { metrics } = await client.send("Performance.getMetrics");
    heapMb = Math.max(heapMb, (metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0) / 1024 / 1024);
  }

  const report = {
    medidoEm: new Date().toISOString(),
    ambiente: "local: build de produção + pilha local; Chromium headless 1366x768; composição padrão 1080x1080",
    execucoes: 3,
    medianas: Object.fromEntries(Object.entries(times).map(([key, values]) => [key, median(values)])),
    amostras: times,
    exportacaoPngKb: Math.round(median(exportSizes) / 1024),
    heapJsEditorMaxMb: Math.round(heapMb),
  };
  writeFileSync("docs/evidencias/desempenho-operacoes.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});
