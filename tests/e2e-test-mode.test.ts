import { afterEach, describe, expect, it, vi } from "vitest";
import { e2eFalBaseUrl } from "@/lib/ai/providers/test-mode";
import { isAllowedFalHost } from "@/lib/ai/providers/fal-provider";

/** O simulador da fal.ai só pode ser habilitado em execução local de testes, nunca em produção. */
describe("modo de teste do provedor de IA", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fica desativado por padrão", () => {
    vi.stubEnv("E2E_MODE", "");
    vi.stubEnv("E2E_FAL_BASE_URL", "http://127.0.0.1:54400");
    expect(e2eFalBaseUrl()).toBeNull();
    expect(isAllowedFalHost("http://127.0.0.1:54400/fal-ai/flux/schnell")).toBe(false);
  });

  it("aceita somente loopback via http quando E2E_MODE=true", () => {
    vi.stubEnv("E2E_MODE", "true");
    vi.stubEnv("E2E_FAL_BASE_URL", "http://127.0.0.1:54400/qualquer");
    expect(e2eFalBaseUrl()).toBe("http://127.0.0.1:54400");
    expect(isAllowedFalHost("http://127.0.0.1:54400/fal-ai/flux/requests/x/status")).toBe(true);
    expect(isAllowedFalHost("http://127.0.0.1:9999/x")).toBe(false);
  });

  it.each(["https://evil.example.com", "http://10.0.0.5:54400", "http://169.254.169.254", "file:///etc/passwd", "não-url"])(
    "rejeita destino não-loopback: %s", (raw) => {
      vi.stubEnv("E2E_MODE", "true");
      vi.stubEnv("E2E_FAL_BASE_URL", raw);
      expect(e2eFalBaseUrl()).toBeNull();
    });

  it.each(["RAILWAY_ENVIRONMENT", "RAILWAY_PROJECT_ID"])("é ignorado quando %s está definido", (name) => {
    vi.stubEnv("E2E_MODE", "true");
    vi.stubEnv("E2E_FAL_BASE_URL", "http://127.0.0.1:54400");
    vi.stubEnv(name, "production");
    expect(e2eFalBaseUrl()).toBeNull();
  });
});
