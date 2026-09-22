import { describe, expect, it } from "vitest";
import { accessMutationSchema, inviteUserSchema, roleMutationSchema } from "@/lib/validation/admin";

describe("administração de usuários", () => {
  it("aceita somente os três perfis previstos", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    expect(roleMutationSchema.safeParse({ user_id: userId, role: "admin" }).success).toBe(true);
    expect(roleMutationSchema.safeParse({ user_id: userId, role: "owner" }).success).toBe(false);
  });

  it("exige ao menos um perfil no convite", () => {
    expect(inviteUserSchema.safeParse({ full_name: "Usuário Teste", email: "teste@example.com", department: "Contabilidade", roles: [] }).success).toBe(false);
  });

  it("restringe o status de ativação a booleanos serializados", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    expect(accessMutationSchema.safeParse({ user_id: userId, is_active: "false" }).success).toBe(true);
    expect(accessMutationSchema.safeParse({ user_id: userId, is_active: "yes" }).success).toBe(false);
  });
});
