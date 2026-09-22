import { describe, expect, it } from "vitest";
import { brandingSchema, defaultBranding, defaultLayouts, detailsSchema, layoutSchema, readLayout } from "@/lib/content/editorial";
import { contentSchema } from "@/lib/validation/content";

describe("personalização editorial segura", () => {
  it("rejeita URLs executáveis e dimensões fora dos limites", () => {
    expect(detailsSchema.safeParse({ image_url: "javascript:alert(1)" }).success).toBe(false);
    expect(brandingSchema.safeParse({ ...defaultBranding, logo_url: "data:image/svg+xml,x" }).success).toBe(false);
    expect(layoutSchema.safeParse({ ...defaultLayouts.internal_campaign, width: 90000 }).success).toBe(false);
    expect(layoutSchema.safeParse({ ...defaultLayouts.internal_campaign, show_image: "false" }).success).toBe(false);
  });
  it("não interpreta conteúdo arbitrário como configuração visual", () => {
    expect(readLayout({ css: "arbitrary" }, "accounting_newsletter")).toEqual(defaultLayouts.accounting_newsletter);
    expect(brandingSchema.safeParse({ ...defaultBranding, primary_color: "url(example)" }).success).toBe(false);
  });
  it("rejeita datas inexistentes e referências de template inválidas", () => {
    const content = { category: "internal_communication", title: "Comunicado de teste" };
    expect(contentSchema.safeParse({ ...content, reference_date: "2026-02-30" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...content, template_id: "not-a-uuid" }).success).toBe(false);
  });
});
