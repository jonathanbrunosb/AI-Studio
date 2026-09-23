import { describe, expect, it } from "vitest";
import { loginSchema, passwordSchema, recoverySchema } from "@/lib/validation/auth";
import { appUrl, matchesRoutePrefix, protectedPrefixes, safeInternalRedirect } from "@/lib/auth/routes";

describe("autenticação e rotas", () => {
  it("valida credenciais estruturadas sem aceitar senha vazia", () => {
    expect(loginSchema.safeParse({ email: "usuario@empresa.com", password: "senha" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "invalido", password: "" }).success).toBe(false);
  });

  it("não revela existência da conta na validação de recuperação", () => {
    expect(recoverySchema.safeParse({ email: "usuario@empresa.com" }).success).toBe(true);
    expect(recoverySchema.safeParse({ email: "texto-invalido" }).success).toBe(false);
  });

  it("exige senha forte e confirmação idêntica", () => {
    expect(passwordSchema.safeParse({ password: "senha-curta", confirmation: "senha-curta" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "UmaSenhaLonga#2026", confirmation: "OutraSenhaLonga#2026" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "UmaSenhaLonga#2026", confirmation: "UmaSenhaLonga#2026" }).success).toBe(true);
  });

  it("classifica todas as áreas internas como protegidas", () => {
    for (const path of protectedPrefixes) expect(matchesRoutePrefix(path, protectedPrefixes)).toBe(true);
    expect(matchesRoutePrefix("/login", protectedPrefixes)).toBe(false);
  });

  it("bloqueia redirecionamentos externos", () => {
    expect(safeInternalRedirect("/biblioteca")).toBe("/biblioteca");
    expect(safeInternalRedirect("//dominio-malicioso.example")).toBe("/dashboard");
    expect(safeInternalRedirect("https://dominio-malicioso.example")).toBe("/dashboard");
  });
});

describe("URL pública de redirecionamento", () => {
  it("usa NEXT_PUBLIC_APP_URL em vez do host interno da requisição", () => {
    expect(appUrl("/dashboard", "http://localhost:8080/auth/callback", "https://aistudio.example.com").href).toBe("https://aistudio.example.com/dashboard");
  });
  it("não permite redirecionar para outro domínio", () => {
    expect(appUrl("//evil.example.com", "http://localhost:8080/x", "https://aistudio.example.com").href).toBe("https://aistudio.example.com/");
    expect(appUrl("https://evil.example.com", "http://localhost:8080/x", "https://aistudio.example.com").origin).toBe("https://aistudio.example.com");
  });
  it("sem configuração válida, usa a origem da requisição", () => {
    expect(appUrl("/login", "http://127.0.0.1:3100/x", undefined).href).toBe("http://127.0.0.1:3100/login");
    expect(appUrl("/login", "http://127.0.0.1:3100/x", "não-url").href).toBe("http://127.0.0.1:3100/login");
  });
});
