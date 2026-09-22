"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { requestPasswordRecovery, type AuthActionState } from "@/app/auth/actions";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = { status: "idle" };

export function RecoveryForm() {
  const [state, action] = useActionState(requestPasswordRecovery, initialState);
  return <form action={action} className="space-y-4">{state.message && <div role="status" className={`rounded-xl border p-3 text-sm ${state.status === "success" ? "border-blue-100 bg-blue-50 text-blue-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{state.message}</div>}<label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">E-mail corporativo</span><span className="relative block"><Mail size={17} className="absolute left-3.5 top-3 text-slate-400" /><input className="field pl-10" type="email" name="email" autoComplete="email" required placeholder="nome@empresa.com.br" /></span>{state.fieldErrors?.email?.[0] && <span className="mt-1 block text-xs text-rose-600">{state.fieldErrors.email[0]}</span>}</label><SubmitButton>Enviar instruções</SubmitButton></form>;
}
