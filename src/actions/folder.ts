"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import { createFolderSchema, renameFolderSchema } from "@/lib/folder-schemas";
import {
  FolderNotFoundError,
  createFolder,
  deleteFolder,
  renameFolder,
} from "@/services/folder-service";
import { WorldNotFoundError } from "@/services/world-service";
import type { ZodError } from "zod";

export type FolderFormState = {
  errors?: Partial<Record<"name", string>>;
  formError?: string;
  values?: { name?: string };
};

export type FolderDeleteState = {
  formError?: string;
};

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFrom(error: ZodError): FolderFormState["errors"] {
  const errors: FolderFormState["errors"] = {};
  for (const issue of error.issues) {
    if (issue.path[0] === "name") {
      errors.name ??= issue.message;
    }
  }
  return errors;
}

// Aucun redirect() dans ce fichier (contrairement a actions/entity.ts et
// actions/world.ts) : creer/renommer/supprimer un dossier n'est jamais une
// navigation, c'est un reglage local de la sidebar - c'est l'appelant
// (create-folder-dialog.tsx, rename-folder-dialog.tsx, delete-folder-dialog.tsx)
// qui referme le dialogue apres un succes, jamais depuis un effet (cf.
// commentaire dans folder-row-actions.tsx).
export async function createFolderAction(
  _prevState: FolderFormState,
  formData: FormData,
): Promise<FolderFormState> {
  const worldId = stringField(formData, "worldId");
  const rawParentId = stringField(formData, "parentId");
  const values = { name: stringField(formData, "name") };

  const parsed = createFolderSchema.safeParse({
    name: formData.get("name"),
    parentId: rawParentId === "" ? null : rawParentId,
  });
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), values };
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return { formError: "Session expirée. Reconnectez-vous.", values };
  }

  try {
    await createFolder(session.user.id, worldId, parsed.data);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof FolderNotFoundError) {
      return { formError: "Monde ou dossier parent introuvable.", values };
    }
    console.error("[folder] Création de dossier échouée :", error);
    return { formError: "Création impossible pour le moment. Réessayez.", values };
  }

  revalidatePath("/(app)/worlds/[slug]", "layout");
  return {};
}

export async function renameFolderAction(
  _prevState: FolderFormState,
  formData: FormData,
): Promise<FolderFormState> {
  const worldId = stringField(formData, "worldId");
  const folderId = stringField(formData, "folderId");
  const values = { name: stringField(formData, "name") };

  const parsed = renameFolderSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), values };
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return { formError: "Session expirée. Reconnectez-vous.", values };
  }

  try {
    await renameFolder(session.user.id, worldId, folderId, parsed.data);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof FolderNotFoundError) {
      return { formError: "Dossier introuvable.", values };
    }
    console.error("[folder] Renommage de dossier échoué :", error);
    return { formError: "Renommage impossible pour le moment. Réessayez.", values };
  }

  revalidatePath("/(app)/worlds/[slug]", "layout");
  return {};
}

export async function deleteFolderAction(
  _prevState: FolderDeleteState,
  formData: FormData,
): Promise<FolderDeleteState> {
  const worldId = stringField(formData, "worldId");
  const folderId = stringField(formData, "folderId");

  let session;
  try {
    session = await requireSession();
  } catch {
    return { formError: "Session expirée. Reconnectez-vous." };
  }

  try {
    await deleteFolder(session.user.id, worldId, folderId);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof FolderNotFoundError) {
      return { formError: "Dossier introuvable." };
    }
    console.error("[folder] Suppression de dossier échouée :", error);
    return { formError: "Suppression impossible pour le moment. Réessayez." };
  }

  revalidatePath("/(app)/worlds/[slug]", "layout");
  return {};
}
