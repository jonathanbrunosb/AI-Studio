"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="primary-button w-full py-3 disabled:cursor-wait disabled:opacity-70">{pending && <LoaderCircle size={17} className="animate-spin" />}{pending ? "Processando..." : children}</button>;
}
