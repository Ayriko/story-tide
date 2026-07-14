"use server";

import { requireSession } from "@/lib/auth-session";
import { InvalidContentError, extractPlainText, parseContent } from "@/lib/tiptap-content";
import { EntityNotFoundError, updateEntityContent } from "@/services/entity-service";
import { WorldNotFoundError } from "@/services/world-service";

export type SaveContentResult = { ok: true } | { ok: false; error: string };

// Mitigation DoS (OWASP A04) : borne AVANT JSON.parse, pas apres - un payload
// arbitrairement gros ne doit jamais atteindre le parseur JSON. 1 Mo est tres
// large pour une fiche de wiki (texte + attrs), largement suffisant en usage
// normal.
const MAX_CONTENT_JSON_BYTES = 1_000_000;

// Pas un <form action> classique : appelee directement depuis le client
// (auto-save debounce), pas via useActionState/redirect. Next.js autorise
// l'appel direct d'une Server Action comme une fonction async depuis un
// Client Component.
//
// rawContentJson est une CHAINE JSON (pas l'objet Tiptap directement) :
// passer l'arbre JSON imbrique de Tiptap en argument positionnel brut a un
// appel direct de Server Action declenchait une vraie erreur de serialisation
// Next.js ("Cannot access level on the server. You cannot dot into a
// temporary client reference..." - "level" etant l'attr du node heading,
// donc pas une erreur ProseMirror). Une chaine traverse toujours Flight comme
// donnee simple deja resolue, aucune ambiguite possible.
export async function saveEntityContentAction(
  worldId: string,
  entityId: string,
  rawContentJson: string,
): Promise<SaveContentResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "Session expirée. Reconnectez-vous." };
  }

  if (Buffer.byteLength(rawContentJson, "utf8") > MAX_CONTENT_JSON_BYTES) {
    return { ok: false, error: "Contenu trop volumineux." };
  }

  let rawContent: unknown;
  try {
    rawContent = JSON.parse(rawContentJson);
  } catch {
    return { ok: false, error: "Contenu invalide." };
  }

  let content;
  try {
    content = parseContent(rawContent);
  } catch (error) {
    if (error instanceof InvalidContentError) {
      return { ok: false, error: "Contenu invalide." };
    }
    throw error;
  }

  const plainText = extractPlainText(content);

  try {
    await updateEntityContent(session.user.id, worldId, entityId, content, plainText);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof EntityNotFoundError) {
      return { ok: false, error: "Fiche introuvable." };
    }
    return { ok: false, error: "Enregistrement impossible pour le moment." };
  }

  return { ok: true };
}
