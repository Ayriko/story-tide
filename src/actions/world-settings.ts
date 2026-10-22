"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import {
  customTypeSchema,
  nativeTypeVisibilitySchema,
  reassignMapSchema,
  type CustomTypeInput,
} from "@/lib/entity-type-schemas";
import {
  CustomTypeLabelTakenError,
  CustomTypeNotFoundError,
  LastSelectableTypeError,
  ReassignMapStaleError,
  createCustomType,
  deleteCustomType,
  setNativeTypeHidden,
  updateCustomType,
} from "@/services/entity-type-service";
import {
  customRelationTypeSchema,
  nativeRelationTypeVisibilitySchema,
  relationReassignMapSchema,
  type CustomRelationTypeInput,
} from "@/lib/relation-type-schemas";
import {
  CustomRelationTypeNotFoundError,
  LastSelectableRelationTypeError,
  RelationReassignKindError,
  RelationReassignStaleError,
  RelationTypeInUseError,
  RelationTypeLabelTakenError,
  createCustomRelationType,
  deleteCustomRelationType,
  setNativeRelationTypeHidden,
  updateCustomRelationType,
} from "@/services/relation-type-service";
import { WorldNotFoundError } from "@/services/world-service";
import type { ZodError } from "zod";

// Parametrage des types d'un monde (KAN-81, ADR-0030). Chaque action :
// 1) Zod, 2) session, 3) appartenance du monde (et du type) verifiee dans le
// service (getWorld - OWASP A01), 4) erreurs typees, jamais de throw brut.
// worldId/typeId viennent du client : jamais crus, toujours revalides.

export type CustomTypeFormState = {
  errors?: Partial<Record<"label" | "group" | "icon", string>>;
  formError?: string;
  values?: { label?: string; group?: string; icon?: string };
  ok?: boolean;
};

export type WorldSettingsActionState = { formError?: string; ok?: boolean };

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFrom(error: ZodError): CustomTypeFormState["errors"] {
  const errors: CustomTypeFormState["errors"] = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "label" || field === "group" || field === "icon") {
      errors[field] ??= issue.message;
    }
  }
  return errors;
}

async function sessionOrLogin() {
  try {
    return await requireSession();
  } catch {
    redirect("/login");
  }
}

// "layout" : la sidebar, la combobox et le graphe lisent le catalogue charge
// par worlds/[slug]/layout.tsx (meme patron que BUG-004, src/actions/entity.ts).
function revalidateWorld() {
  revalidatePath("/(app)/worlds/[slug]", "layout");
}

function customTypeValues(formData: FormData) {
  return {
    label: stringField(formData, "label"),
    group: stringField(formData, "group"),
    icon: stringField(formData, "icon"),
  };
}

async function saveCustomType(
  formData: FormData,
  save: (ownerId: string, input: CustomTypeInput) => Promise<unknown>,
  failureLog: string,
): Promise<CustomTypeFormState> {
  const values = customTypeValues(formData);
  const parsed = customTypeSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), values };
  }

  const session = await sessionOrLogin();

  try {
    await save(session.user.id, parsed.data);
  } catch (error) {
    if (error instanceof CustomTypeLabelTakenError) {
      return { errors: { label: error.message }, values };
    }
    if (error instanceof WorldNotFoundError || error instanceof CustomTypeNotFoundError) {
      return { formError: "Type introuvable.", values };
    }
    console.error(failureLog, error);
    return { formError: "Enregistrement impossible pour le moment. Réessayez.", values };
  }

  revalidateWorld();
  return { ok: true };
}

export async function createCustomTypeAction(
  _prevState: CustomTypeFormState,
  formData: FormData,
): Promise<CustomTypeFormState> {
  const worldId = stringField(formData, "worldId");
  return saveCustomType(
    formData,
    (ownerId, input) => createCustomType(ownerId, worldId, input),
    "[world-settings] Création de type échouée :",
  );
}

export async function updateCustomTypeAction(
  _prevState: CustomTypeFormState,
  formData: FormData,
): Promise<CustomTypeFormState> {
  const worldId = stringField(formData, "worldId");
  const typeId = stringField(formData, "typeId");
  return saveCustomType(
    formData,
    (ownerId, input) => updateCustomType(ownerId, worldId, typeId, input),
    "[world-settings] Modification de type échouée :",
  );
}

export async function setNativeTypeHiddenAction(
  _prevState: WorldSettingsActionState,
  formData: FormData,
): Promise<WorldSettingsActionState> {
  const worldId = stringField(formData, "worldId");
  const parsed = nativeTypeVisibilitySchema.safeParse({
    type: stringField(formData, "type"),
    hidden: stringField(formData, "hidden") === "true",
  });
  if (!parsed.success) {
    return { formError: "Type invalide." };
  }

  const session = await sessionOrLogin();

  try {
    await setNativeTypeHidden(session.user.id, worldId, parsed.data.type, parsed.data.hidden);
  } catch (error) {
    if (error instanceof LastSelectableTypeError) {
      return { formError: error.message };
    }
    if (error instanceof WorldNotFoundError) {
      return { formError: "Monde introuvable." };
    }
    console.error("[world-settings] Masquage de type échoué :", error);
    return { formError: "Modification impossible pour le moment. Réessayez." };
  }

  revalidateWorld();
  return { ok: true };
}

// Carte de reaffectation postee en champs "reassign:<entityId>" = cle cible
// (native ou `custom:<id>`), un par entree du type supprime.
const REASSIGN_PREFIX = "reassign:";

export async function deleteCustomTypeAction(
  _prevState: WorldSettingsActionState,
  formData: FormData,
): Promise<WorldSettingsActionState> {
  const worldId = stringField(formData, "worldId");
  const typeId = stringField(formData, "typeId");
  const rawMap: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith(REASSIGN_PREFIX) && typeof value === "string") {
      rawMap[name.slice(REASSIGN_PREFIX.length)] = value;
    }
  }
  const parsed = reassignMapSchema.safeParse(rawMap);
  if (!parsed.success) {
    return { formError: "Choisis un type cible pour chaque entrée." };
  }

  const session = await sessionOrLogin();

  try {
    await deleteCustomType(session.user.id, worldId, typeId, parsed.data);
  } catch (error) {
    if (error instanceof ReassignMapStaleError || error instanceof LastSelectableTypeError) {
      return { formError: error.message };
    }
    if (error instanceof WorldNotFoundError || error instanceof CustomTypeNotFoundError) {
      return { formError: "Type introuvable." };
    }
    console.error("[world-settings] Suppression de type échouée :", error);
    return { formError: "Suppression impossible pour le moment. Réessayez." };
  }

  revalidateWorld();
  return { ok: true };
}

// --- Types de relation (KAN-84, ADR-0031) : meme patron que les types
// d'entrees ci-dessus. ---

export type CustomRelationTypeFormState = {
  errors?: Partial<Record<"label" | "symmetric" | "inverseLabel", string>>;
  formError?: string;
  values?: { label?: string; symmetric?: string; inverseLabel?: string };
  ok?: boolean;
};

async function saveCustomRelationType(
  formData: FormData,
  save: (ownerId: string, input: CustomRelationTypeInput) => Promise<unknown>,
  failureLog: string,
): Promise<CustomRelationTypeFormState> {
  const values = {
    label: stringField(formData, "label"),
    symmetric: stringField(formData, "symmetric"),
    inverseLabel: stringField(formData, "inverseLabel"),
  };
  const parsed = customRelationTypeSchema.safeParse({
    label: values.label,
    // Radio non coche : undefined, refuse par le schema (« Choisis le sens »).
    symmetric: values.symmetric === "" ? undefined : values.symmetric === "true",
    // Le champ inverse n'est rendu que pour un type dirige.
    inverseLabel: values.inverseLabel,
  });
  if (!parsed.success) {
    const errors: CustomRelationTypeFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "label" || field === "symmetric" || field === "inverseLabel") {
        errors[field] ??= issue.message;
      }
    }
    return { errors, values };
  }

  const session = await sessionOrLogin();

  try {
    await save(session.user.id, parsed.data);
  } catch (error) {
    if (error instanceof RelationTypeLabelTakenError) {
      return { errors: { [error.field]: error.message }, values };
    }
    if (error instanceof RelationTypeInUseError) {
      return { errors: { symmetric: error.message }, values };
    }
    if (error instanceof WorldNotFoundError || error instanceof CustomRelationTypeNotFoundError) {
      return { formError: "Type introuvable.", values };
    }
    console.error(failureLog, error);
    return { formError: "Enregistrement impossible pour le moment. Réessayez.", values };
  }

  revalidateWorld();
  return { ok: true };
}

export async function createCustomRelationTypeAction(
  _prevState: CustomRelationTypeFormState,
  formData: FormData,
): Promise<CustomRelationTypeFormState> {
  const worldId = stringField(formData, "worldId");
  return saveCustomRelationType(
    formData,
    (ownerId, input) => createCustomRelationType(ownerId, worldId, input),
    "[world-settings] Création de type de relation échouée :",
  );
}

export async function updateCustomRelationTypeAction(
  _prevState: CustomRelationTypeFormState,
  formData: FormData,
): Promise<CustomRelationTypeFormState> {
  const worldId = stringField(formData, "worldId");
  const typeId = stringField(formData, "typeId");
  return saveCustomRelationType(
    formData,
    (ownerId, input) => updateCustomRelationType(ownerId, worldId, typeId, input),
    "[world-settings] Modification de type de relation échouée :",
  );
}

export async function setNativeRelationTypeHiddenAction(
  _prevState: WorldSettingsActionState,
  formData: FormData,
): Promise<WorldSettingsActionState> {
  const worldId = stringField(formData, "worldId");
  const parsed = nativeRelationTypeVisibilitySchema.safeParse({
    type: stringField(formData, "type"),
    hidden: stringField(formData, "hidden") === "true",
  });
  if (!parsed.success) {
    return { formError: "Type invalide." };
  }

  const session = await sessionOrLogin();

  try {
    await setNativeRelationTypeHidden(
      session.user.id,
      worldId,
      parsed.data.type,
      parsed.data.hidden,
    );
  } catch (error) {
    if (error instanceof LastSelectableRelationTypeError) {
      return { formError: error.message };
    }
    if (error instanceof WorldNotFoundError) {
      return { formError: "Monde introuvable." };
    }
    console.error("[world-settings] Masquage de type de relation échoué :", error);
    return { formError: "Modification impossible pour le moment. Réessayez." };
  }

  revalidateWorld();
  return { ok: true };
}

// Carte postee en champs "reassign:<relationId>" = cle cible, comme pour les
// types d'entrees.
export async function deleteCustomRelationTypeAction(
  _prevState: WorldSettingsActionState,
  formData: FormData,
): Promise<WorldSettingsActionState> {
  const worldId = stringField(formData, "worldId");
  const typeId = stringField(formData, "typeId");
  const rawMap: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith(REASSIGN_PREFIX) && typeof value === "string") {
      rawMap[name.slice(REASSIGN_PREFIX.length)] = value;
    }
  }
  const parsed = relationReassignMapSchema.safeParse(rawMap);
  if (!parsed.success) {
    return { formError: "Choisis un type cible pour chaque relation." };
  }

  const session = await sessionOrLogin();

  try {
    await deleteCustomRelationType(session.user.id, worldId, typeId, parsed.data);
  } catch (error) {
    if (
      error instanceof RelationReassignStaleError ||
      error instanceof RelationReassignKindError ||
      error instanceof LastSelectableRelationTypeError
    ) {
      return { formError: error.message };
    }
    if (error instanceof WorldNotFoundError || error instanceof CustomRelationTypeNotFoundError) {
      return { formError: "Type introuvable." };
    }
    console.error("[world-settings] Suppression de type de relation échouée :", error);
    return { formError: "Suppression impossible pour le moment. Réessayez." };
  }

  revalidateWorld();
  return { ok: true };
}
