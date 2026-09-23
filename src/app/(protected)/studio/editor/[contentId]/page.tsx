import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VisualEditor } from "@/components/studio/editor/visual-editor";
import { requireUser } from "@/lib/auth/authorization";
import { getBranding } from "@/lib/content/branding-service";
import { loadEditorProject } from "@/lib/editor/editor-service";
import { getProviderConfigurationStatus } from "@/lib/ai/providers/selected-provider";
import { loadAiConfiguration } from "@/lib/ai/repository/supabase-generation-repository";
import { listContentJobs } from "@/lib/ai/services/job-queries";

export default async function VisualEditorPage({ params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params;
  const { supabase, roles, user } = await requireUser();
  const { data: content, error } = await supabase.from("contents").select("*").eq("id", contentId).maybeSingle();
  if (error || !content) notFound();
  const canEdit = ["draft", "changes_requested"].includes(content.status)
    && roles.some((role) => role === "admin" || role === "editor")
    && (roles.includes("admin") || content.created_by === user.id);
  if (!canEdit) redirect(`/studio?id=${content.id}`);

  const [brand, editorData, aiConfig, initialJobs] = await Promise.all([
    getBranding(supabase),
    loadEditorProject(supabase, content),
    loadAiConfiguration(supabase),
    listContentJobs(supabase, content.id),
  ]);
  const provider = getProviderConfigurationStatus();
  const aiAvailability = !aiConfig.integrationEnabled
    ? { available: false, reason: "A geração com IA foi desabilitada pelo administrador." }
    : !provider.configured || !provider.serviceRoleConfigured
      ? { available: false, reason: "A integração de IA está indisponível: o provedor ainda não foi configurado no servidor. Oriente o administrador a concluir a configuração em Administração › Inteligência Artificial." }
      : { available: true, reason: null };

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
      aiModels={aiConfig.models.filter((model) => model.isEnabled)}
      aiAvailability={aiAvailability}
      initialJobs={initialJobs}
    />
  </div>;
}
