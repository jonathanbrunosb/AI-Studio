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

export const userId = (email: string) => sql(`select id from auth.users where email='${email}'`);

/**
 * Tenta uma escrita no banco como usuário autenticado (RLS e triggers ativos), sempre revertida.
 * Retorna "blocked" quando o banco recusa (erro) ou quando o RLS filtra todas as linhas (0 afetadas),
 * ou a quantidade de linhas alteradas. Prova que os bloqueios não dependem da interface.
 */
export function writeAsUser(email: string, dml: string) {
  try {
    const output = sql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${userId(email)}', true); with w as (${dml} returning 1) select count(*) from w; rollback;`);
    const affected = output.split("\n").filter((line) => /^\d+$/.test(line)).pop();
    return affected === "0" ? "blocked" : `affected:${affected}`;
  } catch (error) {
    const message = String((error as { stderr?: string }).stderr ?? error);
    // Erros de sintaxe, objeto inexistente ou constraint indicam teste inválido, não bloqueio de acesso.
    if (/syntax error|does not exist|violates check constraint|violates not-null|invalid input/i.test(message)) {
      throw new Error(`Escrita de teste inválida: ${message}`);
    }
    return "blocked";
  }
}

/** Executa uma função/consulta como usuário autenticado, sempre revertida. Retorna "ok" ou a mensagem de erro. */
export function sqlAsUser(email: string, statement: string) {
  try {
    sql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${userId(email)}', true); ${statement}; rollback;`);
    return "ok";
  } catch (error) {
    return String((error as { stderr?: string }).stderr ?? error).trim();
  }
}
