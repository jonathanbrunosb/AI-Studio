import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginAs, sql, users } from "./helpers";
import { createCommunique, openEditorAndPersist } from "./journeys";

/**
 * Evidências de responsividade: captura de tela real por resolução e verificação de rolagem horizontal
 * da página (overflow). Tabelas largas podem rolar dentro do próprio contêiner, o que é aceito.
 */
const viewports = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
];
const pages = ["/dashboard", "/studio", "/biblioteca", "/gestao-editorial", "/publicacoes", "/modelos"];
const outDir = "docs/evidencias/responsivo";

test("responsividade nas quatro resoluções exigidas", async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(outDir, { recursive: true });
  await loginAs(page, users.admin);
  const editorContent = await createCommunique(page, "Fechamento contábil de setembro");
  await openEditorAndPersist(page, editorContent, sql);
  const targets = [...pages, ...(editorContent ? [`/studio/editor/${editorContent}`] : [])];
  const report: Record<string, Record<string, { overflowPx: number }>> = {};

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    report[viewport.name] = {};
    for (const path of targets) {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      report[viewport.name][path.replace(/[0-9a-f-]{36}/, ":id")] = { overflowPx };
      const file = `${viewport.name}${path.replace(/[0-9a-f-]{36}/, "id").replace(/\//g, "_")}.png`;
      await page.screenshot({ path: `${outDir}/${file}` });
    }
  }
  writeFileSync(`${outDir}/overflow.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  const offenders = Object.entries(report).flatMap(([vp, byPage]) => Object.entries(byPage).filter(([, r]) => r.overflowPx > 1).map(([p, r]) => `${vp} ${p}: ${r.overflowPx}px`));
  expect(offenders, offenders.join("\n")).toEqual([]);
});
