import { prisma } from "@/db/client";
import { requireSession } from "@/lib/auth-session";
import { storage } from "@/lib/storage";
import { WorldNotFoundError, getWorld } from "@/services/world-service";

// Resout la reference stable persistee dans image.src (KAN-16) en une URL
// MinIO signee fraiche a chaque requete - jamais de signature expirante
// stockee dans le contenu Tiptap (voir image-service.ts). L'autorisation
// est revalidee ici (getWorld) a chaque lecture : un id d'image valide ne
// suffit pas, il faut appartenir au monde qui la reference (OWASP A01).
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
  return Response.redirect(signedUrl, 302);
}
