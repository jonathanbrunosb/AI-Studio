import { z } from "zod";

export const appRoleSchema = z.enum(["admin", "editor", "approver"]);

export const inviteUserSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  email: z.email().trim().toLowerCase(),
  department: z.string().trim().max(160).optional(),
  roles: z.array(appRoleSchema).min(1, "Selecione pelo menos um perfil."),
});

export const roleMutationSchema = z.object({ user_id: z.string().uuid(), role: appRoleSchema });
export const accessMutationSchema = z.object({ user_id: z.string().uuid(), is_active: z.enum(["true", "false"]) });
