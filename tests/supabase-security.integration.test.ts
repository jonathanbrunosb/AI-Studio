import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && key);

describe.runIf(configured)("segurança Supabase sem autenticação", () => {
  const getClient = () => createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

  it("nega consultas anônimas às tabelas protegidas", async () => {
    for (const table of ["profiles", "user_roles", "contents", "audit_logs", "templates", "brand_settings"] as const) {
      const { data, error } = await getClient().from(table).select("*").limit(1);
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    }
  }, 20_000);

  it("nega duplicação por usuários anônimos", async () => {
    const { data, error } = await getClient().rpc("duplicate_content", { source_id: "00000000-0000-4000-8000-000000000000" });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  }, 20_000);

  it("rejeita credenciais inválidas sem criar sessão", async () => {
    const { data, error } = await getClient().auth.signInWithPassword({ email: "invalid-user@invalid.example", password: "invalid-password-value" });
    expect(error).toBeTruthy();
    expect(data.session).toBeNull();
  }, 20_000);
});
