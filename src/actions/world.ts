"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import { createWorldSchema, updateWorldSchema } from "@/lib/world-schemas";
import {
  createWorld,
  deleteWorld,
  updateWorld,
  WorldNotFoundError,
} from "@/services/world-service";
import type { ZodError } from "zod";

export type WorldFormState = {
  errors?: Partial<Record<"name", string>>;
  formError?: string;
  // Valeur soumise, reaffichee apres une erreur (meme raison qu'auth.ts : React
  // reinitialise les champs non controles d'un <form action> a la resolution).
  values?: Partial<Record<"name", string>>;
};

export type WorldDeleteState = {
  formError?: string;
};

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFrom(error: ZodError): WorldFormState["errors"] {
  const errors: WorldFormState["errors"] = {};
  for (const issue of error.issues) {
    if (issue.path[0] === "name") {
      errors.name ??= issue.message;
    }
  }
  return errors;
}

export async function createWorldAction(
  _prevState: WorldFormState,
  formData: FormData,
): Promise<WorldFormState> {
  const values = { name: stringField(formData, "name") };

  const parsed = createWorldSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), values };
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  let slug: string;
  try {
    const world = await createWorld(session.user.id, parsed.data);
    slug = world.slug;
  } catch (error) {
    // Repli generique (erreur inattendue, ex. panne DB) : ne jamais avaler la
    // cause reelle derriere un message vague (cf. CLAUDE.md).
    console.error("[world] Création de monde échouée :", error);
    return { formError: "Création impossible pour le moment. Réessayez.", values };
  }

  revalidatePath("/worlds");
  redirect(`/worlds/${slug}`);
}

export async function updateWorldAction(
  _prevState: WorldFormState,
  formData: FormData,
): Promise<WorldFormState> {
  const values = { name: stringField(formData, "name") };
  const worldId = stringField(formData, "worldId");

  const parsed = updateWorldSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), values };
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  let slug: string;
  try {
    const world = await updateWorld(session.user.id, worldId, parsed.data);
    slug = world.slug;
  } catch (error) {
    if (error instanceof WorldNotFoundError) {
      return { formError: "Monde introuvable.", values };
    }
    console.error("[world] Mise à jour de monde échouée :", error);
    return { formError: "Mise à jour impossible pour le moment. Réessayez.", values };
  }

  revalidatePath("/worlds");
  revalidatePath(`/worlds/${slug}`);
  redirect(`/worlds/${slug}`);
}

export async function deleteWorldAction(
  _prevState: WorldDeleteState,
  formData: FormData,
): Promise<WorldDeleteState> {
  const worldId = stringField(formData, "worldId");

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  try {
    await deleteWorld(session.user.id, worldId);
  } catch (error) {
    if (error instanceof WorldNotFoundError) {
      return { formError: "Monde introuvable." };
    }
    console.error("[world] Suppression de monde échouée :", error);
    return { formError: "Suppression impossible pour le moment. Réessayez." };
  }

  revalidatePath("/worlds");
  redirect("/worlds");
}
