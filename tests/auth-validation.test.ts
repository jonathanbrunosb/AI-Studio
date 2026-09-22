import { describe, expect, it } from "vitest";
import { loginSchema, passwordSchema, recoverySchema } from "@/lib/validation/auth";
import { matchesRoutePrefix, protectedPrefixes, safeInternalRedirect } from "@/lib/auth/routes";

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
