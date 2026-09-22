import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <div className="surface-card mx-auto mt-20 max-w-lg p-10 text-center"><p className="eyebrow">Erro 404</p><h2 className="mt-3 text-3xl font-bold text-slate-900">Página não encontrada</h2><p className="mt-3 text-slate-500">O módulo solicitado não está disponível neste ambiente.</p><Link href="/" className="primary-button mt-6"><ArrowLeft size={16} />Voltar ao dashboard</Link></div>;
}
