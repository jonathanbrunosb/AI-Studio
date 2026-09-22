"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { updatePasswordAction, type AuthActionState } from "@/app/auth/actions";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = { status: "idle" };

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, initialState);
  return <form action={action} className="space-y-4">{state.message && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{state.message}</div>}{[["password", "Nova senha", "new-password"], ["confirmation", "Confirmar nova senha", "new-password"]].map(([name, label, autocomplete]) => <label key={name} className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><span className="relative block"><LockKeyhole size={17} className="absolute left-3.5 top-3 text-slate-400" /><input className="field pl-10" type="password" name={name} autoComplete={autocomplete} minLength={12} required /></span>{state.fieldErrors?.[name]?.[0] && <span className="mt-1 block text-xs text-rose-600">{state.fieldErrors[name][0]}</span>}</label>)}<p className="text-xs leading-5 text-slate-400">Use pelo menos 12 caracteres e evite senhas utilizadas em outros sistemas.</p><SubmitButton>Definir nova senha</SubmitButton></form>;
}
