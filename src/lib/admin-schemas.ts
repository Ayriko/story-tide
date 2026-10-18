import { z } from "zod";
import { UserPlan, UserRole } from "@/generated/prisma/enums";

// Raison libre obligatoire sur toute action d'administration (KAN-72) : elle
// part telle quelle dans le journal (AdminAuditLog.reason).
const reason = z
  .string()
  .trim()
  .min(5, "La raison doit faire au moins 5 caractères.")
  .max(500, "500 caractères maximum.");

export const changeUserPlanSchema = z.object({
  userId: z.string().min(1),
  plan: z.enum(UserPlan, "Plan inconnu."),
  reason,
});

export const changeUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(UserRole, "Rôle inconnu."),
  reason,
});

// Parametres d'URL de /admin/users : jamais d'erreur affichee pour une valeur
// fantaisiste, on retombe sur la liste complete, page 1.
export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});

export type ChangeUserPlanInput = z.infer<typeof changeUserPlanSchema>;
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
