"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/authorization";
import { brandingSchema } from "@/lib/content/editorial";

export async function saveBrandingAction(_: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const { supabase } = await requireAdmin();
  const result = brandingSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: "Revise os campos. Use cores hexadecimais e uma URL válida para o logotipo." };
  const { error, data } = await supabase.from("brand_settings").update(result.data).eq("id", true).select("id").single();
  if (error || !data) return { error: "Não foi possível salvar a identidade visual." };
  revalidatePath("/modelos"); revalidatePath("/studio"); revalidatePath("/administracao/identidade");
  return { success: true };
}
