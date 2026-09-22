import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VisualEditor } from "@/components/studio/editor/visual-editor";
import { requireUser } from "@/lib/auth/authorization";
import { getBranding } from "@/lib/content/branding-service";
import { loadEditorProject } from "@/lib/editor/editor-service";

export default async function VisualEditorPage({ params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params;
  const { supabase, roles, user } = await requireUser();
  const { data: content, error } = await supabase.from("contents").select("*").eq("id", contentId).maybeSingle();
  if (error || !content) notFound();
  const canEdit = ["draft", "changes_requested"].includes(content.status)
    && roles.some((role) => role === "admin" || role === "editor")
    && (roles.includes("admin") || content.created_by === user.id);
  if (!canEdit) redirect(`/studio?id=${content.id}`);

  const [brand, editorData] = await Promise.all([
    getBranding(supabase),
    loadEditorProject(supabase, content),
  ]);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="eyebrow">Editor visual · rascunho</p><h2 className="mt-1 text-xl font-bold text-slate-900">{content.title}</h2></div>
      <Link href={`/studio?id=${content.id}`} className="secondary-button">Voltar aos dados editoriais</Link>
    </div>
    <VisualEditor
      contentId={content.id}
      contentTitle={content.title}
      seed={{
        title: content.title,
        subtitle: content.subtitle,
        description: content.description,
        organization: brand.organization,
        primaryColor: brand.primary_color,
        accentColor: brand.accent_color,
        fontFamily: brand.font_family,
        footerText: brand.footer_text,
      }}
      initialProject={editorData.project}
      initialMedia={editorData.media}
      initialHistory={editorData.history}
      templates={editorData.templates}
      userId={user.id}
    />
  </div>;
}
