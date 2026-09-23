import { expect, test } from "@playwright/test";
import { login, loginAs, users } from "./helpers";

test("rejeita credenciais inválidas sem revelar qual campo falhou", async ({ page }) => {
  await login(page, users.editor, "senha-errada-123");
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos." })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("bloqueia usuário inativo mesmo com senha correta", async ({ page }) => {
  await login(page, users.inactive);
  await expect(page.getByRole("alert").filter({ hasText: "Acesso indisponível" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("login válido, sessão persistente, redirecionamento seguro e logout", async ({ page }) => {
  await page.goto("/login?redirect=https://evil.example/phish");
  await page.getByLabel("E-mail corporativo").fill(users.editor);
  await page.getByLabel("Senha").fill("E2e-Senha-Forte-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/dashboard/);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Olá, Editora/ })).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "Encerrar sessão" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/biblioteca");
  await expect(page).toHaveURL(/\/login/);
});

test("redireciona para a página solicitada após o login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/biblioteca");
  await page.getByLabel("E-mail corporativo").fill(users.editor);
  await page.getByLabel("Senha").fill("E2e-Senha-Forte-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/biblioteca/);
});

test("recuperação de senha responde de forma neutra", async ({ page }) => {
  await page.goto("/recuperar-senha");
  await page.getByLabel(/e-mail/i).fill("nao-existe@e2e.invalid");
  await page.getByRole("button", { name: /enviar|recuperar/i }).click();
  await expect(page.getByText(/Se o e-mail estiver cadastrado/)).toBeVisible();
});

test("sessão expirada/removida exige novo login", async ({ page }) => {
  await loginAs(page, users.editor);
  await page.context().clearCookies();
  await page.goto("/gestao-editorial");
  await expect(page).toHaveURL(/\/login/);
});
