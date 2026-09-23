import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, PlugZap, Route, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/lib/auth/authorization";
import { getSigningKey } from "@/lib/publications/signing";
import { contentCategoryLabels } from "@/types/content";
import { createClientAction, dismissTokenAction, revokeClientAction, saveDestinationAction, toggleDestinationAction, updateIntegrationSettingsAction, updateMappingAction } from "./actions";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: destinations }, { data: mappings }, { data: clients }, { data: failures }] = await Promise.all([
    supabase.from("portal_integration_settings").select("*").maybeSingle(),
    supabase.from("portal_destinations").select("*").order("label"),
    supabase.from("content_category_destinations").select("*"),
    supabase.from("integration_clients").select("id, name, token_prefix, scopes, enabled, last_used_at, created_at, revoked_at").order("created_at", { ascending: false }),
    supabase.from("publication_events").select("id, content_id, source, details, created_at").eq("event", "failed").order("created_at", { ascending: false }).limit(10),
  ]);
  const signing = getSigningKey();
  const newToken = (await cookies()).get("ais_new_client_token")?.value;
  const activeClients = (clients ?? []).filter((client) => client.enabled && !client.revoked_at);
  const operational = Boolean(settings?.api_enabled && activeClients.length && settings.last_sync_at);
  const mode = settings?.api_enabled ? "Integração autenticada (API) + exportação estruturada" : "Exportação estruturada (ZIP) com importação administrativa";

  return <div>
    <PageHeader eyebrow="Administração" title="Integrações — Portal da Contabilidade" description="Destinos, modo de publicação, credenciais da API e histórico de falhas." />
    <Link href="/administracao" className="mb-5 inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft size={14} />Voltar à Administração</Link>
    {params.success && <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-800">{params.success}</p>}
    {params.error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{params.error}</p>}
    {newToken && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">Token da credencial (exibido uma única vez)</p><code className="mt-2 block break-all rounded bg-white p-2 text-xs">{newToken}</code><p className="mt-2 text-xs">Guarde-o apenas no backend do portal (variável de ambiente). Nunca o coloque em arquivos JavaScript servidos ao navegador.</p><form action={dismissTokenAction}><button className="secondary-button mt-2 h-8 px-3 text-xs">Já copiei — ocultar</button></form></div>}

    <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Status label="Status da integração" value={operational ? "Operacional (última comunicação registrada)" : settings?.api_enabled ? "Habilitada, sem comunicação confirmada" : "Integração automática não configurada"} ok={operational} />
      <Status label="Modo de publicação" value={mode} ok />
      <Status label="Última sincronização" value={settings?.last_sync_at ? new Date(settings.last_sync_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Nunca"} ok={Boolean(settings?.last_sync_at)} />
      <Status label="Assinatura dos pacotes" value={signing ? "Configurada (ECDSA P-256)" : "Não configurada — pacotes sem assinatura"} ok={Boolean(signing)} />
    </div>

    <div className="grid gap-5 2xl:grid-cols-2">
      <section className="surface-card p-5">
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><PlugZap size={18} className="text-blue-700" />Configuração</h3>
        <form action={updateIntegrationSettingsAction} className="mt-4 space-y-3 text-sm">
          <label className="flex items-start gap-2"><input type="checkbox" name="api_enabled" defaultChecked={settings?.api_enabled} className="mt-1" /><span><strong>Habilitar API de integração automatizada.</strong><br /><span className="text-xs text-slate-500">Requer um backend seguro no portal que guarde o token. O portal publicado hoje (GitHub Pages) não possui esse backend; mantenha desabilitado até existir.</span></span></label>
          <label className="flex items-start gap-2"><input type="checkbox" name="require_signature" defaultChecked={settings?.require_signature} className="mt-1" /><span><strong>Exigir pacotes assinados.</strong><br /><span className="text-xs text-slate-500">Orientação registrada para o portal (configuração espelhada em data/config.json → aiStudio.requireSignature).</span></span></label>
          <button className="primary-button">Salvar</button>
        </form>
        <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-bold text-slate-700">Chave pública para o portal</p>
          {signing ? <><p className="mt-1">Copie para <code>data/config.json → aiStudio.publicKeySpki</code> no portal. É uma chave pública: pode ser publicada.</p><code className="mt-2 block break-all rounded bg-white p-2">{signing.publicKeyBase64}</code></> : <p className="mt-1">Defina <code>PORTAL_SIGNING_PRIVATE_KEY</code> (ECDSA P-256, PKCS#8 PEM) no servidor. Sem ela, a origem dos pacotes é confirmada manualmente no portal.</p>}
        </div>
      </section>

      <section className="surface-card p-5">
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><KeyRound size={18} className="text-blue-700" />Credenciais da API</h3>
        <form action={createClientAction} className="mt-4 flex gap-2"><input name="name" className="field" placeholder="Ex.: Backend do Portal" required minLength={3} maxLength={80} /><button className="primary-button whitespace-nowrap">Criar credencial</button></form>
        <ul className="mt-4 divide-y divide-slate-100 text-sm">{(clients ?? []).map((client) => <li key={client.id} className="flex flex-wrap items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="font-bold text-slate-800">{client.name}</p><p className="text-[11px] text-slate-500">{client.token_prefix}… · {client.scopes.join(", ")} · último uso: {client.last_used_at ? new Date(client.last_used_at).toLocaleString("pt-BR") : "nunca"}</p></div>{client.revoked_at ? <span className="text-xs font-bold text-slate-400">Revogada</span> : <form action={revokeClientAction}><input type="hidden" name="id" value={client.id} /><button className="secondary-button h-8 px-3 text-xs text-rose-700">Revogar</button></form>}</li>)}{!clients?.length && <li className="py-3 text-xs text-slate-400">Nenhuma credencial criada.</li>}</ul>
        <p className="mt-3 text-[11px] text-slate-500">Endpoints: <code>/api/integrations/portal/v1/publications</code> (GET), <code>…/{"{id}"}</code> (GET), <code>…/{"{id}"}/assets</code> (GET), <code>…/{"{id}"}/acknowledge</code> (POST). Autenticação <code>Authorization: Bearer</code>. Documentação em docs/INTEGRACAO_PORTAL.md.</p>
      </section>

      <section className="surface-card p-5 2xl:col-span-2">
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><Route size={18} className="text-blue-700" />Destinos disponíveis e mapeamento</h3>
        <p className="mt-1 text-xs text-slate-500">Somente destinos existentes no portal. Hoje o portal possui a coleção <strong>newsletter</strong> (Newsletter Contábil, com a categoria &ldquo;Comunicado Interno&rdquo;) e <strong>noticias</strong> (Notícias &amp; Impactos). Não há aba própria para comunicados nem para anúncios de sistemas.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">{(destinations ?? []).map((destination) => <div key={destination.id} className="rounded-xl border border-slate-200 p-3 text-xs"><div className="flex items-center gap-2"><p className="flex-1 font-bold text-slate-800">{destination.label}</p><span className={destination.enabled ? "text-emerald-700" : "text-slate-400"}>{destination.enabled ? "Habilitado" : "Desabilitado"}</span><form action={toggleDestinationAction}><input type="hidden" name="id" value={destination.id} /><input type="hidden" name="enabled" value={String(!destination.enabled)} /><button className="secondary-button h-7 px-2 text-[11px]">{destination.enabled ? "Desabilitar" : "Habilitar"}</button></form></div><p className="mt-1 text-slate-500"><code>{destination.id}</code> · coleção {destination.portal_collection} · categoria &ldquo;{destination.portal_category}&rdquo;</p>{destination.notes && <p className="mt-1 text-slate-400">{destination.notes}</p>}</div>)}
            <form action={saveDestinationAction} className="grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-xs sm:grid-cols-2"><input name="id" className="field" placeholder="identificador (ex.: noticias_impactos)" required /><input name="label" className="field" placeholder="Rótulo" required /><select name="portal_collection" className="field"><option value="newsletter">newsletter</option><option value="noticias">noticias</option></select><input name="portal_category" className="field" placeholder="Categoria no portal" required /><input name="notes" className="field sm:col-span-2" placeholder="Observações (opcional)" /><button className="secondary-button sm:col-span-2">Salvar destino</button></form>
          </div>
          <div className="space-y-3">{Object.entries(contentCategoryLabels).map(([category, label]) => { const rows = (mappings ?? []).filter((row) => row.category === category); return <div key={category} className="rounded-xl border border-slate-200 p-3 text-xs"><p className="font-bold text-slate-800">{label}</p><ul className="mt-2 space-y-1">{rows.map((row) => <li key={row.destination_id} className="flex items-center gap-2"><span className="flex-1">{destinations?.find((item) => item.id === row.destination_id)?.label ?? row.destination_id}{row.is_default && <strong className="ml-1 text-blue-700">(padrão)</strong>}</span>{!row.is_default && <form action={updateMappingAction}><input type="hidden" name="category" value={category} /><input type="hidden" name="destination_id" value={row.destination_id} /><input type="hidden" name="operation" value="default" /><button className="text-[11px] font-bold text-blue-700">Tornar padrão</button></form>}<form action={updateMappingAction}><input type="hidden" name="category" value={category} /><input type="hidden" name="destination_id" value={row.destination_id} /><input type="hidden" name="operation" value="remove" /><button className="text-[11px] font-bold text-rose-700">Remover</button></form></li>)}{!rows.length && <li className="text-amber-700">Sem destino: conteúdos desta categoria não podem ser preparados.</li>}</ul><form action={updateMappingAction} className="mt-2 flex gap-2"><input type="hidden" name="category" value={category} /><input type="hidden" name="operation" value="add" /><select name="destination_id" className="field h-8 py-1 text-[11px]">{(destinations ?? []).map((destination) => <option key={destination.id} value={destination.id}>{destination.label}</option>)}</select><button className="secondary-button h-8 px-2 text-[11px]">Adicionar</button></form></div>; })}</div>
        </div>
      </section>

      <section className="surface-card p-5 2xl:col-span-2">
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><ShieldAlert size={18} className="text-rose-700" />Histórico de falhas</h3>
        {settings?.last_error && <p className="mt-2 text-xs text-rose-700">Última falha: {settings.last_error} ({settings.last_error_at ? new Date(settings.last_error_at).toLocaleString("pt-BR") : ""})</p>}
        <ul className="mt-3 space-y-2 text-xs">{(failures ?? []).map((failure) => <li key={failure.id} className="rounded-lg bg-rose-50 p-2 text-rose-800">{new Date(failure.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · origem {failure.source === "portal_api" ? "portal (API)" : "usuário"} · {String((failure.details as Record<string, unknown>)?.message ?? "sem detalhes")} · <Link className="font-bold underline" href={`/publicacoes?historico=${failure.content_id}`}>ver publicação</Link></li>)}{!failures?.length && <li className="text-slate-400">Nenhuma falha registrada.</li>}</ul>
      </section>
    </div>
  </div>;
}

function Status({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="surface-card p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 flex items-start gap-1.5 text-sm font-bold ${ok ? "text-slate-800" : "text-amber-700"}`}>{ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}{value}</p></div>;
}
