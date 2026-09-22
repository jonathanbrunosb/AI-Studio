"use client";

import { useActionState, useState } from "react";
import { saveContentAction } from "@/app/(protected)/studio/actions";
import { CreativeCanvas } from "./creative-canvas";
import { readDetails, readLayout, type Branding, type EditorialLayout } from "@/lib/content/editorial";
import type { Tables } from "@/types/database";
import { contentCategoryLabels, type ContentCategory } from "@/types/content";

export function StudioForm({ content, category, template, brand, readOnly = false }: {
  content?: Tables<"contents"> | null; category: ContentCategory;
  template?: Tables<"templates"> | null; brand: Branding; readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(saveContentAction, {});
  const [title, setTitle] = useState(content?.title ?? "");
  const [subtitle, setSubtitle] = useState(content?.subtitle ?? "");
  const [description, setDescription] = useState(content?.description ?? "");
  const [details, setDetails] = useState(readDetails(content?.editorial_details));
  const [layout, setLayout] = useState<EditorialLayout>(readLayout(content?.layout_snapshot ?? template?.configuration, category));
  const field = (name: keyof typeof details, label: string, type = "text", required = false) => <label className="block" key={name}><span className="mb-1 block text-xs font-bold text-slate-600">{label}</span><input className="field" name={name} type={type} required={required} value={details[name] ?? ""} onChange={(e) => setDetails({ ...details, [name]: e.target.value })} /></label>;
  return <form id="studio-content-form" action={action}>
    {state.error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{state.error}</p>}
    <input type="hidden" name="id" value={content?.id ?? ""} />
    <input type="hidden" name="category" value={category} />
    <input type="hidden" name="template_id" value={content?.template_id ?? template?.id ?? ""} />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,1fr)_minmax(380px,1.25fr)]">
      <fieldset disabled={readOnly || pending} className="surface-card min-w-0 space-y-4 p-5 disabled:opacity-70">
        <div className="border-b border-slate-100 pb-4"><p className="eyebrow">{contentCategoryLabels[category]}</p><h3 className="mt-1 font-bold">Informações editoriais</h3><p className="mt-1 text-xs text-slate-500">Modelo: {template?.name ?? "Composição personalizada"}</p></div>
        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Título</span><input name="title" className="field" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">{category === "accounting_newsletter" ? "Resumo da notícia" : "Subtítulo"}</span><input name="subtitle" className="field" maxLength={240} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></label>
        {category === "system_announcement" && <>{field("solution_name", "Nome da solução", "text", true)}{field("functionality", "Funcionalidade implementada", "text", true)}{field("access_url", "Link de acesso", "url")}</>}
        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">{category === "system_announcement" ? "Descrição da atualização" : "Texto principal"}</span><textarea name="description" rows={5} maxLength={5000} className="field" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        {["internal_campaign", "internal_communication"].includes(category) && field("audience", "Público-alvo")}
        {category === "internal_campaign" && field("call_to_action", "Chamada para participação")}
        <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-bold text-slate-600">Fonte</span><input name="source_name" className="field" maxLength={160} defaultValue={content?.source_name ?? ""} /></label><label><span className="mb-1 block text-xs font-bold text-slate-600">{category === "accounting_newsletter" ? "Data da notícia" : "Data de referência"}</span><input name="reference_date" type="date" className="field" defaultValue={content?.reference_date ?? ""} /></label></div>
        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Link de referência</span><input name="source_url" type="url" className="field" defaultValue={content?.source_url ?? ""} /></label>
        {field("image_url", "Imagem de apoio (URL)", "url")}{field("image_alt", "Descrição acessível da imagem")}
        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Coleção / projeto</span><input name="collection_name" className="field" maxLength={100} placeholder="Ex.: Fechamento mensal" defaultValue={content?.collection_name ?? ""} /></label>
        {!readOnly && <button disabled={pending} className="primary-button w-full">{pending ? "Salvando…" : content ? "Salvar alterações" : "Criar rascunho"}</button>}
      </fieldset>
      <div className="min-w-0 space-y-5">
        <section className="surface-card overflow-hidden"><div className="p-5"><h3 className="font-bold">Pré-visualização</h3><p className="mt-1 text-xs text-slate-500">Acompanhe o texto e a composição enquanto trabalha.</p></div><CreativeCanvas title={title} subtitle={subtitle} description={description} details={details} layout={layout} brand={brand} /></section>
        <fieldset disabled={readOnly || pending} className="surface-card space-y-4 p-5"><legend className="px-1 text-sm font-bold">Composição deste material</legend><p className="text-xs text-slate-500">Suas escolhas são salvas apenas nesta peça. O modelo corporativo permanece disponível para novas criações.</p><div className="grid grid-cols-2 gap-3">{(["width", "height"] as const).map((key) => <label key={key} className="text-xs font-semibold text-slate-600">{key === "width" ? "Largura (px)" : "Altura (px)"}<input className="field mt-1" type="number" name={key} min={600} max={key === "width" ? 2400 : 3200} value={layout[key]} onChange={(e) => setLayout({ ...layout, [key]: Number(e.target.value) })} /></label>)}</div><label className="block text-xs font-semibold text-slate-600">Alinhamento<select name="alignment" className="field mt-1" value={layout.alignment} onChange={(e) => setLayout({ ...layout, alignment: e.target.value as "left" | "center" })}><option value="left">À esquerda</option><option value="center">Centralizado</option></select></label>{(["show_image", "show_footer"] as const).map((key) => <label key={key} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name={key} checked={layout[key]} onChange={(e) => setLayout({ ...layout, [key]: e.target.checked })} />{key === "show_image" ? "Exibir imagem de apoio" : "Exibir assinatura institucional"}</label>)}</fieldset>
      </div>
    </div>
  </form>;
}
