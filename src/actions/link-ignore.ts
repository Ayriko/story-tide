"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import { EntityNotFoundError } from "@/services/entity-service";
import { ignoreLink, unignoreLink } from "@/services/relation-service";
import { WorldNotFoundError } from "@/services/world-service";

export type LinkIgnoreFormState = {
  formError?: string;
};

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// "Ignorer ce lien" (KAN-23, garde-fou anti-faux-positifs) : reste sur la
// meme page (pas de redirect), revalidatePath rafraichit la liste "Entites
// liees"/"Liens ignores" au prochain rendu.
export async function ignoreLinkAction(
  _prevState: LinkIgnoreFormState,
  formData: FormData,
): Promise<LinkIgnoreFormState> {
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
    await ignoreLink(session.user.id, worldId, entityId, targetId);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof EntityNotFoundError) {
      return { formError: "Entrée introuvable." };
    }
    console.error("[link-ignore] Ignorer le lien a échoué :", error);
    return { formError: "Action impossible pour le moment. Réessayez." };
  }

  revalidatePath(`/worlds/${worldSlug}/entities/${entityId}`);
  return {};
}

export async function unignoreLinkAction(
  _prevState: LinkIgnoreFormState,
  formData: FormData,
): Promise<LinkIgnoreFormState> {
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
    await unignoreLink(session.user.id, worldId, entityId, targetId);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof EntityNotFoundError) {
      return { formError: "Entrée introuvable." };
    }
    console.error("[link-ignore] Ne plus ignorer le lien a échoué :", error);
    return { formError: "Action impossible pour le moment. Réessayez." };
  }

  revalidatePath(`/worlds/${worldSlug}/entities/${entityId}`);
  return {};
}
