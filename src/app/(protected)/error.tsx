"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div role="alert" className="surface-card p-10 text-center"><h2 className="text-xl font-bold text-slate-900">Não foi possível carregar esta área</h2><p className="mt-3 text-sm text-slate-500">Tente novamente em instantes. Seus materiais salvos permanecem no acervo.</p><button onClick={reset} className="primary-button mt-5">Tentar novamente</button></div>;
}
