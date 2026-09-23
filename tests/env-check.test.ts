import { describe, expect, it } from "vitest";
import { checkEnvironment } from "@/lib/config/env-check";

const base = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk", SUPABASE_SERVICE_ROLE_KEY: "sk", NEXT_PUBLIC_APP_URL: "https://aistudio.example.com" };

describe("verificação de configuração", () => {
  it("aponta variáveis obrigatórias ausentes sem expor valores", () => {
    const result = checkEnvironment({ NODE_ENV: "production", SUPABASE_SERVICE_ROLE_KEY: "segredo" });
    expect(result.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(result.missing).toContain("NEXT_SERVER_ACTIONS_ENCRYPTION_KEY");
    expect(JSON.stringify(result)).not.toContain("segredo");
  });
  it("exige HTTPS e chave de Server Actions em produção", () => {
    const result = checkEnvironment({ ...base, NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://aistudio.example.com" });
    expect(result.problems).toContain("NEXT_PUBLIC_APP_URL deve usar HTTPS");
    expect(result.missing).toEqual(["NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"]);
  });
  it("sinaliza HSTS sem HTTPS e E2E_MODE no Railway", () => {
    const result = checkEnvironment({ ...base, NEXT_PUBLIC_APP_URL: "http://localhost:3000", ENABLE_HSTS: "true", E2E_MODE: "true", RAILWAY_ENVIRONMENT: "production" });
    expect(result.problems).toHaveLength(2);
  });
  it("configuração completa não gera pendências e lista recursos opcionais desativados", () => {
    const result = checkEnvironment({ ...base, NODE_ENV: "production", NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "k" });
    expect(result.missing).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(result.disabledFeatures).toEqual(["FAL_KEY", "PORTAL_SIGNING_PRIVATE_KEY"]);
  });
});
