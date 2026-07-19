"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import { createEntitySchema, searchEntitiesSchema, updateEntitySchema } from "@/lib/entity-schemas";
import {
  EntityNotFoundError,
  EntityQuotaExceededError,
  createEntity,
  deleteEntity,
  searchEntities,
  updateEntity,
  type EntitySearchResult,
} from "@/services/entity-service";
import { WorldNotFoundError } from "@/services/world-service";
import type { ZodError } from "zod";

export type EntityFormState = {
  errors?: Partial<Record<"name" | "type" | "aliases", string>>;
  formError?: string;
  // Valeurs soumises, reaffichees apres une erreur (meme raison qu'auth.ts/world.ts).
  values?: { name?: string; type?: string; aliases?: string };
};

export type EntityDeleteState = {
  formError?: string;
};

export type SearchEntitiesResult =
  { ok: true; entities: EntitySearchResult[] } | { ok: false; error: string };

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// Un alias par ligne dans une textarea plutot qu'une liste de champs geree en
// JS cote client - le schema (aliasesSchema) filtre les vides et deduplique.
function aliasesFromField(formData: FormData): string[] {
  return stringField(formData, "aliases")
    .split("\n")
    .map((line) => line.trim());
}

function fieldErrorsFrom(error: ZodError): EntityFormState["errors"] {
  const errors: EntityFormState["errors"] = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "name" || field === "type" || field === "aliases") {
      errors[field] ??= issue.message;
    }
  }
  return errors;
}

export async function createEntityAction(
  _prevState: EntityFormState,
  formData: FormData,
): Promise<EntityFormState> {
  const worldId = stringField(formData, "worldId");
  const worldSlug = stringField(formData, "worldSlug");
  const values = {
    name: stringField(formData, "name"),
    type: stringField(formData, "type"),
    aliases: stringField(formData, "aliases"),
  };

  const parsed = createEntitySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    aliases: aliasesFromField(formData),
  });
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), values };
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  let entityId: string;
  try {
    const entity = await createEntity(session.user.id, worldId, parsed.data);
    entityId = entity.id;
  } catch (error) {
    if (error instanceof WorldNotFoundError) {
      return { formError: "Monde introuvable.", values };
    }
    if (error instanceof EntityQuotaExceededError) {
      return { formError: error.message, values };
    }
    console.error("[entity] Création de fiche échouée :", error);
    return { formError: "Création impossible pour le moment. Réessayez.", values };
  }

  revalidatePath(`/worlds/${worldSlug}`);
  redirect(`/worlds/${worldSlug}/entities/${entityId}`);
}

export async function updateEntityAction(
  _prevState: EntityFormState,
  formData: FormData,
): Promise<EntityFormState> {
  const worldId = stringField(formData, "worldId");
  const worldSlug = stringField(formData, "worldSlug");
  const entityId = stringField(formData, "entityId");
  const values = {
    name: stringField(formData, "name"),
    type: stringField(formData, "type"),
    aliases: stringField(formData, "aliases"),
  };

  const parsed = updateEntitySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    aliases: aliasesFromField(formData),
  });
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), values };
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  try {
    await updateEntity(session.user.id, worldId, entityId, parsed.data);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof EntityNotFoundError) {
      return { formError: "Fiche introuvable.", values };
    }
    console.error("[entity] Mise à jour de fiche échouée :", error);
    return { formError: "Mise à jour impossible pour le moment. Réessayez.", values };
  }

  revalidatePath(`/worlds/${worldSlug}`);
  revalidatePath(`/worlds/${worldSlug}/entities/${entityId}`);
  redirect(`/worlds/${worldSlug}/entities/${entityId}`);
}

export async function deleteEntityAction(
  _prevState: EntityDeleteState,
  formData: FormData,
): Promise<EntityDeleteState> {
  const worldId = stringField(formData, "worldId");
  const worldSlug = stringField(formData, "worldSlug");
  const entityId = stringField(formData, "entityId");

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  try {
    await deleteEntity(session.user.id, worldId, entityId);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof EntityNotFoundError) {
      return { formError: "Fiche introuvable." };
    }
    console.error("[entity] Suppression de fiche échouée :", error);
    return { formError: "Suppression impossible pour le moment. Réessayez." };
  }

  revalidatePath(`/worlds/${worldSlug}`);
  redirect(`/worlds/${worldSlug}`);
}

// Lecture, pas une mutation : appelee directement depuis le client (recherche
// au fil de la frappe, debounce), pas via useActionState/redirect - meme
// raison que saveEntityContentAction. worldId vient du client donc non fiable :
// searchEntities revalide l'appartenance via getWorld (OWASP A01).
export async function searchEntitiesAction(
  worldId: string,
  rawQuery: string,
): Promise<SearchEntitiesResult> {
  const parsed = searchEntitiesSchema.safeParse({ query: rawQuery });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "Session expirée. Reconnectez-vous." };
  }

  try {
    const entities = await searchEntities(session.user.id, worldId, parsed.data.query);
    return { ok: true, entities };
  } catch (error) {
    if (error instanceof WorldNotFoundError) {
      return { ok: false, error: "Monde introuvable." };
    }
    console.error("[entity] Recherche de fiches échouée :", error);
    return { ok: false, error: "Recherche impossible pour le moment." };
  }
}
