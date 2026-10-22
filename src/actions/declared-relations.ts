"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import { declaredRelationSchema } from "@/lib/relation-type-schemas";
import {
  DeclaredRelationDuplicateError,
  DeclaredRelationNotFoundError,
  RelationTypeHiddenError,
  SelfRelationError,
  createDeclaredRelation,
  deleteDeclaredRelation,
  ignoreRelationSuggestion,
  unignoreRelationSuggestion,
} from "@/services/declared-relation-service";
import { EntityNotFoundError } from "@/services/entity-service";
import { CustomRelationTypeNotFoundError } from "@/services/relation-type-service";
import { WorldNotFoundError } from "@/services/world-service";

// Relations declarees depuis une fiche (KAN-84, ADR-0031), patron de
// link-ignore.ts : 1) Zod, 2) session, 3) appartenance du monde, de la fiche,
// de l'autre entree et du type verifiee dans le service (OWASP A01),
// 4) erreurs typees. Reste sur la page (pas de redirect).

export type DeclaredRelationFormState = {
  errors?: Partial<Record<"otherId" | "choice", string>>;
  formError?: string;
  ok?: boolean;
};

export type RelationActionState = { formError?: string };

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// Les deux fiches affichent la relation, la Constellation et le mini-graphe
// du tableau de bord aussi.
function revalidateRelationPages(worldSlug: string, entityIds: string[]) {
  for (const entityId of new Set(entityIds)) {
    revalidatePath(`/worlds/${worldSlug}/entities/${entityId}`);
  }
  revalidatePath(`/worlds/${worldSlug}/graph`);
  revalidatePath(`/worlds/${worldSlug}`);
}

export async function createDeclaredRelationAction(
  _prevState: DeclaredRelationFormState,
  formData: FormData,
): Promise<DeclaredRelationFormState> {
  const worldId = stringField(formData, "worldId");
  const worldSlug = stringField(formData, "worldSlug");
  const entityId = stringField(formData, "entityId");

  const parsed = declaredRelationSchema.safeParse({
    otherId: stringField(formData, "otherId"),
    choice: stringField(formData, "choice"),
  });
  if (!parsed.success) {
    const errors: DeclaredRelationFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "otherId" || field === "choice") {
        errors[field] ??= issue.message;
      }
    }
    return { errors };
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return { formError: "Session expirée. Reconnectez-vous." };
  }

  let ends;
  try {
    ends = await createDeclaredRelation(
      session.user.id,
      worldId,
      entityId,
      parsed.data.otherId,
      parsed.data.choice,
    );
  } catch (error) {
    if (error instanceof DeclaredRelationDuplicateError || error instanceof SelfRelationError) {
      return { formError: error.message };
    }
    if (
      error instanceof RelationTypeHiddenError ||
      error instanceof CustomRelationTypeNotFoundError
    ) {
      return { errors: { choice: error.message } };
    }
    if (error instanceof WorldNotFoundError || error instanceof EntityNotFoundError) {
      return { formError: "Entrée introuvable." };
    }
    console.error("[declared-relations] Création de relation échouée :", error);
    return { formError: "Ajout impossible pour le moment. Réessayez." };
  }

  revalidateRelationPages(worldSlug, [ends.sourceId, ends.targetId]);
  return { ok: true };
}

export async function deleteDeclaredRelationAction(
  _prevState: RelationActionState,
  formData: FormData,
): Promise<RelationActionState> {
  const worldId = stringField(formData, "worldId");
  const worldSlug = stringField(formData, "worldSlug");
  const relationId = stringField(formData, "relationId");

  let session;
  try {
    session = await requireSession();
  } catch {
    return { formError: "Session expirée. Reconnectez-vous." };
  }

  let ends;
  try {
    ends = await deleteDeclaredRelation(session.user.id, worldId, relationId);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof DeclaredRelationNotFoundError) {
      return { formError: "Relation introuvable." };
    }
    console.error("[declared-relations] Suppression de relation échouée :", error);
    return { formError: "Suppression impossible pour le moment. Réessayez." };
  }

  revalidateRelationPages(worldSlug, [ends.sourceId, ends.targetId]);
  return {};
}

async function toggleSuggestionIgnore(
  formData: FormData,
  run: typeof ignoreRelationSuggestion,
  failureLog: string,
): Promise<RelationActionState> {
  const worldId = stringField(formData, "worldId");
  const worldSlug = stringField(formData, "worldSlug");
  const entityId = stringField(formData, "entityId");
  const targetId = stringField(formData, "targetId");

  let session;
  try {
    session = await requireSession();
  } catch {
    return { formError: "Session expirée. Reconnectez-vous." };
  }

  try {
    await run(session.user.id, worldId, entityId, targetId);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof EntityNotFoundError) {
      return { formError: "Entrée introuvable." };
    }
    console.error(failureLog, error);
    return { formError: "Action impossible pour le moment. Réessayez." };
  }

  // Une suggestion ne vit que sur la fiche qui cite : rien a revalider ailleurs.
  revalidatePath(`/worlds/${worldSlug}/entities/${entityId}`);
  return {};
}

export async function ignoreRelationSuggestionAction(
  _prevState: RelationActionState,
  formData: FormData,
): Promise<RelationActionState> {
  return toggleSuggestionIgnore(
    formData,
    ignoreRelationSuggestion,
    "[declared-relations] Ignorer la suggestion a échoué :",
  );
}

export async function unignoreRelationSuggestionAction(
  _prevState: RelationActionState,
  formData: FormData,
): Promise<RelationActionState> {
  return toggleSuggestionIgnore(
    formData,
    unignoreRelationSuggestion,
    "[declared-relations] Ne plus ignorer la suggestion a échoué :",
  );
}
