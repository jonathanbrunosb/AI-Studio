import { z } from "zod";

export const contentSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  category: z.enum(["internal_communication", "accounting_newsletter", "system_announcement", "internal_campaign"]),
  title: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(200),
  subtitle: z.string().trim().max(240).optional(),
  description: z.string().trim().max(5000).optional(),
  reference_date: z.string().optional(),
  source_name: z.string().trim().max(160).optional(),
  source_url: z.union([
    z.literal(""),
    z.url("Informe uma URL válida.").refine((value) => value.startsWith("https://") || value.startsWith("http://"), "Utilize uma URL HTTP ou HTTPS."),
  ]).optional(),
});
