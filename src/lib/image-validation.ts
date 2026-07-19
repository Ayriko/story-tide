// Validation MIME par magic bytes (KAN-16, OWASP A10) : le Content-Type
// declare par le client (extension de fichier, en-tete envoye) est
// falsifiable - seule l'inspection des premiers octets reels du fichier fait
// foi. Zero dependance tierce (pas de librairie de sniffing type `file-type`) :
// quatre signatures suffisent pour le format autorise, meme esprit "zero
// dependance" que src/lib/linker.
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) {
    return false;
  }
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

// Detecte le type MIME reel a partir des octets de signature (magic bytes).
// Renvoie null si aucune signature connue ne correspond (fichier rejete).
export function sniffImageMime(buffer: Buffer): AllowedImageMimeType | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) {
    return "image/gif";
  }
  // WebP : conteneur RIFF (octets 0-3) + taille (4 octets, ignoree) + "WEBP" a l'offset 8.
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}
