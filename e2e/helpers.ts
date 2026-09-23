import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "E2e-Senha-Forte-123";
export const users = {
  editor: "editor@e2e.invalid",
  approver: "aprovador@e2e.invalid",
  admin: "admin@e2e.invalid",
  inactive: "inativo@e2e.invalid",
} as const;

function env() {
  const values: Record<string, string> = {};
  for (const line of readFileSync(".env.e2e", "utf8").split("\n")) {
    const index = line.indexOf("=");
    if (index > 0) values[line.slice(0, index)] = line.slice(index + 1);
  }
  return values;
}

/** Consulta direta ao banco de E2E para validar o que foi registrado (somente leitura nos testes). */
export function sql(query: string) {
  return execFileSync("psql", [env().E2E_DB_URL, "-Atc", query], { encoding: "utf8" }).trim();
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-mail corporativo").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function loginAs(page: Page, email: string) {
  await page.context().clearCookies();
  await login(page, email);
  await expect(page).toHaveURL(/\/dashboard/);
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;
