import { prisma } from "@/db/client";
import { requireSession } from "@/lib/auth-session";
import { storage } from "@/lib/storage";
import { WorldNotFoundError, getWorld } from "@/services/world-service";

// Resout la reference stable persistee dans image.src (KAN-16) en une URL
// MinIO signee fraiche a chaque requete - jamais de signature expirante
// stockee dans le contenu Tiptap (voir image-service.ts). L'autorisation
// est revalidee ici (getWorld) a chaque lecture : un id d'image valide ne
// suffit pas, il faut appartenir au monde qui la reference (OWASP A01).
//
// L'URL signee est construite avec l'endpoint MinIO INTERNE (reseau Docker,
// jamais expose publiquement - TST-SEC-011) : elle n'est resolvable que
// depuis le serveur, jamais depuis le navigateur. La reponse est donc
// proxy-ee ici (fetch cote serveur, puis stream vers le client) plutot que
// redirigee - le navigateur ne parle jamais qu'a cette route, deja publique
// (BUG-011).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> },
): Promise<Response> {
  const { imageId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response(null, { status: 401 });
  }

  const image = await prisma.image.findUnique({ where: { id: imageId } });
  if (!image) {
    return new Response(null, { status: 404 });
  }

  try {
    await getWorld(session.user.id, image.worldId);
  } catch (error) {
    if (error instanceof WorldNotFoundError) {
      // Meme reponse que "image absente" : aucune fuite d'existence sur une
      // image d'un monde d'autrui (meme garde-fou que getWorld/getEntity).
      return new Response(null, { status: 404 });
    }
    throw error;
  }

  const signedUrl = await storage.getSignedUrl(image.key);

  let upstream: Response;
  try {
    upstream = await fetch(signedUrl);
  } catch (error) {
    // Erreur reseau reelle (MinIO injoignable) - jamais avalee (cf. CLAUDE.md).
    console.error("Recuperation de l'image depuis le stockage impossible", error);
    return new Response(null, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    console.error(`Reponse inattendue du stockage pour l'image ${image.id} : ${upstream.status}`);
    return new Response(null, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      // Contenu immuable par id (uploadImage ne fait jamais qu'un create,
      // jamais d'update - un remplacement produit toujours un nouvel id) ;
      // `private` (pas `public`) car la lecture reste soumise a autorisation
      // (getWorld ci-dessus) - jamais de cache partage.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
