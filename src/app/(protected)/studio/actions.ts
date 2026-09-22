"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/authorization";
import { contentSchema } from "@/lib/validation/content";

export async function saveContentAction(formData: FormData) {
  const { user, roles, supabase } = await requireUser();
  if (!roles.some((role) => role === "admin" || role === "editor")) throw new Error("Você não possui permissão para editar conteúdos.");

  const parsed = contentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/studio?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos")}`);

  const input = parsed.data;
  const payload = {
    category: input.category,
    title: input.title,
    subtitle: input.subtitle || null,
    description: input.description || null,
    reference_date: input.reference_date || null,
    source_name: input.source_name || null,
    source_url: input.source_url || null,
  };

  if (input.id) {
    const { error } = await supabase.from("contents").update(payload).eq("id", input.id);
    if (error) redirect(`/studio?id=${input.id}&error=${encodeURIComponent("Não foi possível salvar este conteúdo.")}`);
    revalidatePath("/dashboard"); revalidatePath("/biblioteca");
    redirect(`/studio?id=${input.id}&saved=1`);
  }

  const { data, error } = await supabase.from("contents").insert({ ...payload, created_by: user.id, status: "draft" }).select("id").single();
  if (error || !data) redirect(`/studio?error=${encodeURIComponent("Não foi possível criar o conteúdo.")}`);
  revalidatePath("/dashboard"); revalidatePath("/biblioteca");
  redirect(`/studio?id=${data.id}&saved=1`);
}
