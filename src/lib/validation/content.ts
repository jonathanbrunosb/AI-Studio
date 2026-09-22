import { z } from "zod";
import { httpUrl } from "@/lib/content/editorial";

export const contentSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  template_id: z.string().uuid().optional().or(z.literal("")),
  collection_name: z.string().trim().max(100).optional(),
  solution_name: z.string().trim().max(160).optional(),
  functionality: z.string().trim().max(500).optional(),
  access_url: httpUrl.optional(),
  audience: z.string().trim().max(200).optional(),
  call_to_action: z.string().trim().max(240).optional(),
  image_url: httpUrl.optional(),
  image_alt: z.string().trim().max(200).optional(),
  category: z.enum(["internal_communication", "accounting_newsletter", "system_announcement", "internal_campaign"]),
  title: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(200),
  subtitle: z.string().trim().max(240).optional(),
  description: z.string().trim().max(5000).optional(),
  reference_date: z.union([z.literal(""), z.iso.date()]).optional(),
  source_name: z.string().trim().max(160).optional(),
  source_url: z.union([
    z.literal(""),
    z.url("Informe uma URL válida.").refine((value) => value.startsWith("https://") || value.startsWith("http://"), "Utilize uma URL HTTP ou HTTPS."),
  ]).optional(),
});
