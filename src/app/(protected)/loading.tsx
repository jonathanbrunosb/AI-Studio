export default function Loading() {
  return <div role="status" aria-label="Carregando conteúdos" className="space-y-5 animate-pulse"><div className="h-20 rounded-xl bg-slate-200" /><div className="grid gap-5 md:grid-cols-2">{[1,2,3,4].map((key) => <div key={key} className="h-56 rounded-xl bg-slate-100" />)}</div><span className="sr-only">Carregando…</span></div>;
}
