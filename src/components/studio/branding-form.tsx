"use client";

import { useActionState, useState } from "react";
import { saveBrandingAction } from "@/app/(protected)/administracao/identidade/actions";
import { CreativeCanvas } from "./creative-canvas";
import type { Branding } from "@/lib/content/editorial";

export function BrandingForm({ brand }: { brand: Branding }) {
  const [draft, setDraft] = useState(brand);
  const [state, action, pending] = useActionState(saveBrandingAction, {});
  return <div className="grid items-start gap-6 lg:grid-cols-2"><form action={action} className="surface-card space-y-5 p-6">
    <h3 className="font-bold text-slate-900">Elementos institucionais</h3>
    <p className="text-sm leading-6 text-slate-500">As alterações atualizam a identidade de todos os modelos e materiais. O conteúdo e o layout individual de cada peça são preservados.</p>
    {state.error && <p role="alert" className="text-sm text-rose-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-blue-700">Identidade atualizada.</p>}
    <fieldset disabled={pending} className="space-y-4">
      {([["organization", "Nome institucional"], ["logo_url", "URL do logotipo"], ["footer_text", "Assinatura / rodapé"]] as const).map(([key,label]) => <label key={key} className="block text-xs font-bold text-slate-600">{label}<input className="field mt-1" name={key} type={key === "logo_url" ? "url" : "text"} required={key === "organization"} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
      <div className="grid grid-cols-2 gap-4">{([["primary_color", "Azul principal"], ["accent_color", "Cor de apoio"]] as const).map(([key,label]) => <label key={key} className="text-xs font-bold text-slate-600">{label}<div className="mt-2 flex items-center gap-3"><input aria-label={label} type="color" name={key} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className="h-10 w-16" /><span>{draft[key]}</span></div></label>)}</div>
      <label className="block text-xs font-bold text-slate-600">Tipografia<select name="font_family" className="field mt-1" value={draft.font_family} onChange={(e) => setDraft({ ...draft, font_family: e.target.value as Branding["font_family"] })}><option>Calibri</option><option>Segoe UI</option><option>Arial</option></select></label>
      <button disabled={pending} className="primary-button w-full">{pending ? "Salvando…" : "Salvar identidade visual"}</button>
    </fieldset>
  </form><CreativeCanvas title="Uma comunicação com identidade" subtitle="Consistência em cada material." description="Visualize as cores, a assinatura institucional e a tipografia antes de salvar." brand={draft} /></div>;
}
