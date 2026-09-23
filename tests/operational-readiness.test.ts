import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { getConfiguredAppOrigin } from "@/lib/auth/app-url";

describe("prontidão operacional", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it("expõe health check sem cache quando a configuração pública existe", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "ai-studio" });
  });

  it("recusa health check quando faltam variáveis obrigatórias", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect((await GET()).status).toBe(503);
  });

  it("aceita HTTPS e HTTP apenas para desenvolvimento local", () => {
    expect(getConfiguredAppOrigin("https://ai-studio.example.com/caminho")).toBe("https://ai-studio.example.com");
    expect(getConfiguredAppOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(getConfiguredAppOrigin("http://ai-studio.example.com")).toBeNull();
    expect(getConfiguredAppOrigin("javascript:alert(1)")).toBeNull();
  });
});
