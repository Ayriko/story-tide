import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { listEntities } from "@/services/entity-service";
import { WorldShell } from "./world-shell";

// Shell propre a UN monde (KAN-36 P1/P1-ter, reference-vvd.md §6) : ce
// Server Component ne fait QUE recuperer les donnees (session, monde,
// fiches) - tout le rendu (sidebar repliable, TopBar, carte centrale) vit
// dans world-shell.tsx (Client Component, porte l'etat de repli). /worlds
// (hors monde) n'utilise pas ce layout : rien a mettre dans une sidebar de
// fiches avant d'avoir choisi un monde - voir worlds/page.tsx.
//
// getWorldBySlug/requireSessionOrRedirect sont deja appeles par chaque page
// enfant (worlds/[slug]/page.tsx, entities/[entityId]/page.tsx, graph/page.tsx)
// - re-appeles ici pour le besoin propre du layout (nom du monde pour le fil
// d'ariane, liste des fiches pour la sidebar). Meme patron deja en place
// avant KAN-36 (layout + page appelaient deja chacun requireSessionOrRedirect) ;
// pas de cache() ajoute ici (toucherait le service, hors perimetre de cette
// session).
export default async function WorldLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireSessionOrRedirect();

  let world;
  try {
    world = await getWorldBySlug(session.user.id, slug);
  } catch (error) {
    if (error instanceof WorldNotFoundError) {
      notFound();
    }
    throw error;
  }

  const entities = await listEntities(session.user.id, world.id);

  return (
    <WorldShell
      worldId={world.id}
      worldName={world.name}
      worldSlug={world.slug}
      entities={entities.map(({ id, name, type }) => ({ id, name, type }))}
      userName={session.user.name}
      userEmail={session.user.email}
    >
      {children}
    </WorldShell>
  );
}
