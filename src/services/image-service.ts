import { randomUUID } from "node:crypto";
import { prisma } from "@/db/client";
import { storage } from "@/lib/storage";
import { IMAGE_TOO_LARGE_MESSAGE, MAX_IMAGE_BYTES, sniffImageMime } from "@/lib/image-validation";
import { env } from "@/env";
import { getWorld } from "./world-service";

export { MAX_IMAGE_BYTES };

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

// Chaine toujours la cause reelle (jamais d'erreur avalee, cf. CLAUDE.md) :
// un echec MinIO (bucket absent, service indisponible) ne doit jamais
// disparaitre derriere le message generique affiche a l'utilisateur.
export class ImageStorageError extends Error {
  constructor(cause?: unknown) {
    super("Envoi de l'image impossible.", { cause });
    this.name = "ImageStorageError";
  }
}

// isSafeHttpUrl (tiptap-content.ts) exige une URL http(s) ABSOLUE <= 2048
// caracteres pour image.src - une URL MinIO presignee est trop longue et
// expire. On persiste donc une reference stable (cette route), resolue en
// URL signee fraiche a chaque lecture par src/app/api/media/[imageId]/route.ts.
export async function uploadImage(
  ownerId: string,
  worldId: string,
  buffer: Buffer,
): Promise<{ id: string; src: string }> {
  await getWorld(ownerId, worldId);

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(IMAGE_TOO_LARGE_MESSAGE);
  }

  // Sniffing par magic bytes (OWASP A10) : jamais le Content-Type declare par
  // le client, falsifiable (extension renommee, en-tete usurpe).
  const mime = sniffImageMime(buffer);
  if (!mime) {
    throw new ImageValidationError("Type de fichier non pris en charge.");
  }

  const key = randomUUID();
  try {
    await storage.upload({ key, body: buffer, contentType: mime });
  } catch (error) {
    throw new ImageStorageError(error);
  }

  const image = await prisma.image.create({
    data: { worldId, key, contentType: mime, size: buffer.byteLength },
  });

  return { id: image.id, src: `${env.BETTER_AUTH_URL}/api/media/${image.id}` };
}
