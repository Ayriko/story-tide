"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { changeUserPlanSchema, changeUserRoleSchema } from "@/lib/admin-schemas";
import { AdminNotFoundError, requireAdmin } from "@/lib/auth-session";
import {
  AdminNoChangeError,
  AdminSelfDemotionError,
  AdminUserNotFoundError,
  changeUserPlan,
  changeUserRole,
} from "@/services/admin-user-service";

export type AdminUserFormState = {
  errors?: Partial<Record<"value" | "reason", string>>;
  formError?: string;
  // Confirmation inline apres succes (pas de toast dans le projet).
  success?: string;
  // Raison soumise, reaffichee apres une erreur (React reinitialise les champs
  // non controles d'un <form action> a la resolution).
  values?: { reason?: string };
};

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// `valueField` = nom du champ porteur du choix dans le schema ("plan" ou
// "role"), ramene sur la cle unique "value" de l'etat de formulaire.
function fieldErrorsFrom(error: ZodError, valueField: string): AdminUserFormState["errors"] {
  const errors: AdminUserFormState["errors"] = {};
  for (const issue of error.issues) {
    if (issue.path[0] === "reason") {
      errors.reason ??= issue.message;
    } else if (issue.path[0] === valueField) {
      errors.value ??= issue.message;
    }
  }
  return errors;
}

// Garde AVANT la validation Zod (exception deliberee a l'ordre habituel
// "Zod puis session") : un anonyme ou un compte standard doit recevoir la
// meme reponse "Introuvable." quel que soit ce qu'il envoie - une erreur de
// validation trahirait l'existence de l'action (OWASP A01, patron
// 404-identique, ADR-0029).
async function adminOrState(): Promise<
  { session: Awaited<ReturnType<typeof requireAdmin>> } | { state: AdminUserFormState }
> {
  try {
    return { session: await requireAdmin() };
  } catch (error) {
    if (error instanceof AdminNotFoundError) {
      return { state: { formError: error.message } };
    }
    console.error("[admin] Vérification du rôle échouée :", error);
    return { state: { formError: "Action impossible pour le moment. Réessayez." } };
  }
}

function serviceErrorState(
  error: unknown,
  logLabel: string,
  values: AdminUserFormState["values"],
): AdminUserFormState {
  if (
    error instanceof AdminUserNotFoundError ||
    error instanceof AdminNoChangeError ||
    error instanceof AdminSelfDemotionError
  ) {
    return { formError: error.message, values };
  }
  console.error(`[admin] ${logLabel} :`, error);
  return { formError: "Modification impossible pour le moment. Réessayez.", values };
}

function revalidateUser(userId: string): void {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function changeUserPlanAction(
  _prevState: AdminUserFormState,
  formData: FormData,
): Promise<AdminUserFormState> {
  const guard = await adminOrState();
  if ("state" in guard) {
    return guard.state;
  }

  const values = { reason: stringField(formData, "reason") };
  const parsed = changeUserPlanSchema.safeParse({
    userId: formData.get("userId"),
    plan: formData.get("plan"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error, "plan"), values };
  }

  try {
    await changeUserPlan(
      guard.session.user.id,
      parsed.data.userId,
      parsed.data.plan,
      parsed.data.reason,
    );
  } catch (error) {
    return serviceErrorState(error, "Changement de plan échoué", values);
  }

  revalidateUser(parsed.data.userId);
  return { success: `Plan passé à ${parsed.data.plan}.` };
}

export async function changeUserRoleAction(
  _prevState: AdminUserFormState,
  formData: FormData,
): Promise<AdminUserFormState> {
  const guard = await adminOrState();
  if ("state" in guard) {
    return guard.state;
  }

  const values = { reason: stringField(formData, "reason") };
  const parsed = changeUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error, "role"), values };
  }

  try {
    await changeUserRole(
      guard.session.user.id,
      parsed.data.userId,
      parsed.data.role,
      parsed.data.reason,
    );
  } catch (error) {
    return serviceErrorState(error, "Changement de rôle échoué", values);
  }

  revalidateUser(parsed.data.userId);
  return { success: `Rôle passé à ${parsed.data.role}.` };
}
