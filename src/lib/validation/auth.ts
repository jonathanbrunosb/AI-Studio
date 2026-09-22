import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  password: z.string().min(1, "Informe sua senha."),
});

export const recoverySchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
});

export const passwordSchema = z.object({
  password: z.string().min(12, "A nova senha deve ter pelo menos 12 caracteres."),
  confirmation: z.string(),
}).refine((data) => data.password === data.confirmation, {
  message: "As senhas não coincidem.",
  path: ["confirmation"],
});
