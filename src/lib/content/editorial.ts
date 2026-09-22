import { z } from "zod";
import type { ContentCategory } from "@/types/content";

export const categories = ["internal_communication", "accounting_newsletter", "system_announcement", "internal_campaign"] as const;
export const httpUrl = z.union([z.literal(""), z.url().refine((v) => /^https?:\/\//.test(v), "Utilize uma URL HTTP ou HTTPS.")]);
export const layoutSchema = z.object({
  layout: z.enum(["notice", "newsletter", "system", "campaign"]),
  width: z.number().int().min(600).max(2400),
  height: z.number().int().min(600).max(3200),
  show_image: z.boolean(),
  show_footer: z.boolean(),
  alignment: z.enum(["left", "center"]),
});
export type EditorialLayout = z.infer<typeof layoutSchema>;
export const defaultLayouts: Record<ContentCategory, EditorialLayout> = {
  internal_communication: { layout: "notice", width: 1080, height: 1080, show_image: true, show_footer: true, alignment: "left" },
  accounting_newsletter: { layout: "newsletter", width: 1080, height: 1600, show_image: true, show_footer: true, alignment: "left" },
  system_announcement: { layout: "system", width: 1200, height: 800, show_image: true, show_footer: true, alignment: "left" },
  internal_campaign: { layout: "campaign", width: 1080, height: 1350, show_image: true, show_footer: true, alignment: "center" },
};
export const brandingSchema = z.object({
  organization: z.string().trim().min(2).max(120),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  font_family: z.enum(["Calibri", "Segoe UI", "Arial"]),
  logo_url: httpUrl,
  footer_text: z.string().trim().max(200),
});
export type Branding = z.infer<typeof brandingSchema>;
export const defaultBranding: Branding = { organization: "Gerência de Contabilidade", primary_color: "#0b2b50", accent_color: "#1769aa", font_family: "Calibri", logo_url: "", footer_text: "Comunicação Contábil · AI Studio" };
export const detailsSchema = z.object({
  solution_name: z.string().trim().max(160).optional(),
  functionality: z.string().trim().max(500).optional(),
  access_url: httpUrl.optional(),
  audience: z.string().trim().max(200).optional(),
  call_to_action: z.string().trim().max(240).optional(),
  image_url: httpUrl.optional(),
  image_alt: z.string().trim().max(200).optional(),
});
export type EditorialDetails = z.infer<typeof detailsSchema>;
export function readLayout(value: unknown, category: ContentCategory): EditorialLayout {
  const parsed = layoutSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultLayouts[category];
}
export function readDetails(value: unknown): EditorialDetails {
  const parsed = detailsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}
