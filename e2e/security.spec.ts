import { expect, test } from "@playwright/test";

const protectedPages = ["/dashboard", "/studio", "/biblioteca", "/gestao-editorial", "/publicacoes", "/modelos", "/administracao", "/administracao/ia", "/administracao/integracoes"];

test.describe("proteção de rotas e APIs sem autenticação", () => {
  for (const path of protectedPages) {
    test(`redireciona ${path} para o login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?redirect=${encodeURIComponent(path).replace(/%2F/g, "(%2F|/)")}`));
    });
  }

  test("APIs internas exigem sessão e a API do portal exige token", async ({ request }) => {
    expect((await request.get("/api/ai/generations?contentId=00000000-0000-4000-8000-000000000000")).status()).toBe(401);
    expect((await request.post("/api/ai/generations", { data: {} })).status()).toBe(401);
    expect((await request.get("/api/publications/00000000-0000-4000-8000-000000000000/package")).status()).toBe(401);
    const portal = await request.get("/api/integrations/portal/v1/publications");
    expect(portal.status()).toBe(401);
    expect(portal.headers()["www-authenticate"]).toBe("Bearer");
    const forged = await request.post("/api/integrations/portal/v1/publications/00000000-0000-4000-8000-000000000000/acknowledge", {
      headers: { Authorization: "Bearer ais_forged-token-value-000000000000000" }, data: { status: "published" },
    });
    expect(forged.status()).toBe(401);
  });

  test("health check público sem dados sensíveis", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(Object.keys(await response.json()).sort()).toEqual(["service", "status", "timestamp"]);
  });
});

test.describe("cabeçalhos de segurança", () => {
  test("CSP com nonce e cabeçalhos defensivos, sem erros de CSP na página", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => { if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text()); });
    const response = await page.goto("/login");
    const headers = response!.headers();
    const csp = headers["content-security-policy"];
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["x-request-id"]).toBeTruthy();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
    // Hidratação ocorreu (scripts com nonce executaram) e nenhuma violação foi registrada.
    await page.getByLabel("E-mail corporativo").fill("x");
    expect(violations).toEqual([]);
  });

  test("nonce muda a cada requisição", async ({ request }) => {
    const nonce = async () => (await request.get("/login")).headers()["content-security-policy"].match(/nonce-([^']+)/)?.[1];
    expect(await nonce()).not.toBe(await nonce());
  });
});
