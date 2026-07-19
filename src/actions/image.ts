"use server";

import { requireSession } from "@/lib/auth-session";
import { ImageStorageError, ImageValidationError, uploadImage } from "@/services/image-service";
import { WorldNotFoundError } from "@/services/world-service";

export type UploadImageResult = { ok: true; src: string } | { ok: false; error: string };

// Pas un <form action> classique : appelee directement depuis le client
// (ImageControl, entity-editor.tsx) des qu'un fichier est choisi - meme raison
// que saveEntityContentAction (src/actions/entity-content.ts). worldId vient
// du client donc non fiable : uploadImage revalide via getWorld (OWASP A01).
export async function uploadImageAction(
  worldId: string,
  formData: FormData,
): Promise<UploadImageResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "Session expirée. Reconnectez-vous." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Fichier manquant." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { src } = await uploadImage(session.user.id, worldId, buffer);
    return { ok: true, src };
  } catch (error) {
    if (error instanceof WorldNotFoundError) {
      return { ok: false, error: "Monde introuvable." };
    }
    if (error instanceof ImageValidationError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof ImageStorageError) {
      console.error("[image] Envoi vers le stockage échoué :", error.cause);
      return { ok: false, error: "Envoi impossible pour le moment." };
    }
    console.error("[image] Envoi de l'image échoué :", error);
    return { ok: false, error: "Envoi impossible pour le moment." };
  }
}
