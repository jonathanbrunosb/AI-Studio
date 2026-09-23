import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import { loginAs, sql, users } from "./helpers";
import { createCommunique, openEditorAndPersist } from "./journeys";

/**
 * Medições reais no ambiente local de teste (build de produção + pilha local). NÃO representam a latência
 * do Railway/Supabase em nuvem: servem como linha de base de regressão. Resultado em docs/evidencias/desempenho.json.
 */
const RUNS = 5;
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return Math.round(sorted[Math.floor(sorted.length / 2)]); };

test("linha de base de desempenho (mediana de 5 carregamentos por página)", async ({ page }) => {
  test.setTimeout(300_000);
  await loginAs(page, users.admin);
  const pages = ["/dashboard", "/studio", "/biblioteca", "/gestao-editorial", "/publicacoes", "/modelos", "/administracao"];
  const result: Record<string, Record<string, number>> = {};
  for (const path of pages) {
    const samples: { ttfb: number; dcl: number; load: number; transferKb: number }[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      await page.goto(path, { waitUntil: "load" });
      samples.push(await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        const transfer = nav.transferSize + resources.reduce((sum, item) => sum + (item.transferSize || 0), 0);
        return { ttfb: nav.responseStart - nav.startTime, dcl: nav.domContentLoadedEventEnd - nav.startTime, load: nav.loadEventEnd - nav.startTime, transferKb: transfer / 1024 };
      }));
    }
    result[path] = {
      ttfbMs: median(samples.map((s) => s.ttfb)), domContentLoadedMs: median(samples.map((s) => s.dcl)),
      loadMs: median(samples.map((s) => s.load)),
    };
  }
  // Cache vazio: novo contexto com a mesma sessão, medindo bytes transferidos (comprimidos) e tempo até "load".
  const editorId = await createCommunique(page, "Medição de desempenho");
  await openEditorAndPersist(page, editorId, sql);
  const cold: Record<string, { transferKb: number; loadMs: number }> = {};
  const state = await page.context().storageState();
  for (const path of ["/login", "/dashboard", `/studio/editor/${editorId}`]) {
    const context = await page.context().browser()!.newContext(path === "/login" ? {} : { storageState: state });
    const fresh = await context.newPage();
    let bytes = 0;
    fresh.on("response", async (response) => { const sizes = await response.request().sizes().catch(() => null); bytes += sizes?.responseBodySize ?? 0; });
    const start = Date.now();
    await fresh.goto(path, { waitUntil: "load" });
    const loadMs = Date.now() - start;
    await fresh.waitForTimeout(500);
    cold[path.replace(/[0-9a-f-]{36}/, ":id")] = { transferKb: Math.round(bytes / 1024), loadMs };
    await context.close();
  }

  const health: number[] = [];
  for (let run = 0; run < 20; run += 1) { const start = Date.now(); await page.request.get("/api/health"); health.push(Date.now() - start); }
  const report = {
    medidoEm: new Date().toISOString(), ambiente: "local: next start (build de produção) + PostgreSQL/GoTrue/PostgREST locais, Chromium headless, sem latência de rede",
    amostrasPorPagina: RUNS, paginasComCache: result, cacheVazio: cold, apiHealthMs: { mediana: median(health), max: Math.max(...health) },
  };
  writeFileSync("docs/evidencias/desempenho.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
