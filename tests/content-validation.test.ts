import { describe, expect, it } from "vitest";
import { contentSchema } from "@/lib/validation/content";

const validContent = {
  category: "internal_communication",
  title: "Fechamento contábil",
  subtitle: "Orientações do período",
  description: "Conteúdo de teste",
  reference_date: "2026-09-22",
  source_name: "Contabilidade",
  source_url: "https://intranet.example/referencia",
};

describe("conteúdos editoriais", () => {
  it("aceita as categorias corporativas previstas", () => {
    for (const category of ["internal_communication", "accounting_newsletter", "system_announcement", "internal_campaign"]) {
      expect(contentSchema.safeParse({ ...validContent, category }).success).toBe(true);
    }
  });

  it("rejeita categoria, título e URL inválidos", () => {
    expect(contentSchema.safeParse({ ...validContent, category: "arbitrary" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...validContent, title: "x" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...validContent, source_url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("não aceita status ou proprietário como campos de domínio do formulário", () => {
    const result = contentSchema.parse({ ...validContent, status: "approved", created_by: "arbitrary" });
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("created_by");
  });
});
