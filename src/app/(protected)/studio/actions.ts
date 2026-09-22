"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/authorization";
import { contentSchema } from "@/lib/validation/content";
import { defaultLayouts, layoutSchema, readLayout } from "@/lib/content/editorial";

export type ContentActionState = { error?: string };
export async function saveContentAction(_: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const { user, roles, supabase } = await requireUser();
  if (!roles.some((r) => r === "admin" || r === "editor")) return { error: "Seu perfil não permite editar conteúdos." };
  const parsed = contentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const input = parsed.data;
  if (input.category === "system_announcement" && (!input.solution_name || !input.functionality)) return { error: "Informe o nome da solução e a funcionalidade implementada." };

  let baseLayout = defaultLayouts[input.category];
  if (input.id) {
    const { data } = await supabase.from("contents").select("*").eq("id", input.id).single();
    if (!data || (!roles.includes("admin") && data.created_by !== user.id) || !["draft", "changes_requested"].includes(data.status)) return { error: "Este conteúdo não pode ser editado pelo seu perfil." };
    if (data.category !== input.category || (data.template_id ?? "") !== (input.template_id ?? "")) return { error: "A categoria e o modelo de origem não podem ser alterados." };
    baseLayout = readLayout(data.layout_snapshot, input.category);
  } else if (input.template_id) {
    const { data } = await supabase.from("templates").select("*").eq("id", input.template_id).eq("is_active", true).single();
    if (!data || data.category !== input.category) return { error: "O modelo não está disponível para esta categoria." };
    baseLayout = readLayout(data.configuration, input.category);
  }
  const layout = layoutSchema.safeParse({
    ...baseLayout,
    width: Number(formData.get("width")), height: Number(formData.get("height")),
    alignment: formData.get("alignment"), show_image: formData.get("show_image") === "on",
    show_footer: formData.get("show_footer") === "on",
  });
  if (!layout.success) return { error: "Revise as dimensões e a composição da peça." };

  const editorial_details = {
    image_url: input.image_url ?? "", image_alt: input.image_alt ?? "",
    ...(input.category === "system_announcement" ? { solution_name: input.solution_name, functionality: input.functionality, access_url: input.access_url } : {}),
    ...(["internal_campaign", "internal_communication"].includes(input.category) ? { audience: input.audience } : {}),
    ...(input.category === "internal_campaign" ? { call_to_action: input.call_to_action } : {}),
  };
  const payload = {
    title: input.title, subtitle: input.subtitle || null, description: input.description || null,
    reference_date: input.reference_date || null, source_name: input.source_name || null,
    source_url: input.source_url || null, editorial_details, layout_snapshot: layout.data,
    collection_name: input.collection_name ?? "",
  };
  const result = input.id
    ? await supabase.from("contents").update(payload).eq("id", input.id).select("id").single()
    : await supabase.from("contents").insert({ ...payload, category: input.category, template_id: input.template_id || null, created_by: user.id }).select("id").single();
  if (result.error || !result.data) return { error: "Não foi possível salvar. Verifique suas permissões e tente novamente." };
  revalidatePath("/dashboard"); revalidatePath("/biblioteca"); revalidatePath("/studio");
  redirect(`/studio?id=${result.data.id}&saved=1`);
}

export async function duplicateContentAction(formData: FormData) {
  const { roles, supabase } = await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success || !roles.some((r) => r === "admin" || r === "editor")) redirect("/biblioteca?error=duplicate");
  const { data, error } = await supabase.rpc("duplicate_content", { source_id: id.data });
  if (error || !data) redirect("/biblioteca?error=duplicate");
  revalidatePath("/dashboard"); revalidatePath("/biblioteca");
  redirect(`/studio?id=${data}&copied=1`);
}
