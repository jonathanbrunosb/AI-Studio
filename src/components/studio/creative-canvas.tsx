/* eslint-disable @next/next/no-img-element */
import { Building2 } from "lucide-react";
import { defaultBranding, defaultLayouts, type Branding, type EditorialDetails, type EditorialLayout } from "@/lib/content/editorial";

export function CreativeCanvas({ title, subtitle, description, details = {}, layout = defaultLayouts.internal_communication, brand = defaultBranding, compact = false }: {
  title?: string | null; subtitle?: string | null; description?: string | null;
  details?: EditorialDetails; layout?: EditorialLayout; brand?: Branding; compact?: boolean;
}) {
  return <div className={compact ? "bg-slate-100 p-4" : "rounded-xl bg-slate-100 p-4 md:p-6"}>
    <p className="mb-3 text-xs font-semibold text-slate-500">{layout.width} × {layout.height} px · Prévia de composição</p>
    <article className="mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-lg" style={{ aspectRatio: `${layout.width} / ${layout.height}`, fontFamily: `${brand.font_family}, "Segoe UI", Arial, sans-serif`, textAlign: layout.alignment, borderTop: `6px solid ${brand.accent_color}` }}>
      <header className="flex items-center gap-2 p-4 text-xs font-bold" style={{ color: brand.primary_color }}>
        {brand.logo_url ? <img src={brand.logo_url} referrerPolicy="no-referrer" alt={brand.organization} className="h-8 max-w-28 object-contain" /> : <Building2 size={20} />}
        {brand.organization}
      </header>
      <div className={layout.layout === "system" ? "grid sm:grid-cols-2" : ""}>
        {layout.show_image && <div className={layout.layout === "campaign" ? "relative h-52 overflow-hidden" : "relative h-36 overflow-hidden"} style={{ background: `linear-gradient(130deg,${brand.primary_color},${brand.accent_color})` }}>
          {details.image_url ? <img src={details.image_url} referrerPolicy="no-referrer" alt={details.image_alt || "Imagem de apoio"} className="h-full w-full object-cover" /> : <><div className="absolute -right-8 -top-10 size-48 rounded-full border-[28px] border-white/10" /><span className="absolute bottom-4 left-5 text-xs font-bold uppercase tracking-widest text-white/80">{layout.layout === "newsletter" ? "Em pauta" : layout.layout === "system" ? "Tecnologia e processos" : "Comunicação Contábil"}</span></>}
        </div>}
        <div className={compact ? "p-4" : "p-6"}>
          <h3 className={compact ? "text-lg font-bold leading-tight" : "text-2xl font-bold leading-tight"} style={{ color: brand.primary_color }}>{title || "Título do material"}</h3>
          {subtitle && <p className="mt-3 font-semibold text-slate-500">{subtitle}</p>}
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{description || "O conteúdo editorial será apresentado nesta área."}</p>
          {details.solution_name && <p className="mt-4 text-sm font-bold" style={{ color: brand.accent_color }}>{details.solution_name}</p>}
          {details.functionality && <p className="mt-2 text-sm text-slate-600">{details.functionality}</p>}
          {details.access_url && <p className="mt-3 break-all text-xs underline" style={{ color: brand.accent_color }}>{details.access_url}</p>}
          {details.audience && <p className="mt-3 text-xs text-slate-500">Para: {details.audience}</p>}
          {details.call_to_action && <p className="mt-5 rounded px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: brand.accent_color }}>{details.call_to_action}</p>}
        </div>
      </div>
      {layout.show_footer && <footer className="mt-auto border-t border-slate-100 p-4 text-[11px] font-semibold" style={{ color: brand.primary_color }}>{brand.footer_text}</footer>}
    </article>
  </div>;
}
