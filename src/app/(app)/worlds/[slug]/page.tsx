import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { RenameWorldForm } from "./rename-world-form";
import { DeleteWorldForm } from "./delete-world-form";
import { CreateEntityForm } from "./create-entity-form";

// Nom du monde + fil d'ariane : desormais dans worlds/[slug]/world-shell.tsx
// (TopBar). Recherche/liste des fiches : desormais dans la sidebar
// (sidebar.tsx, reutilise EntitySearch) - plus de duplication ici. Reste sur
// cette page : creation d'une fiche (cible du lien "+ Nouvelle fiche" de la
// sidebar, temporaire jusqu'a P2a) et parametres du monde.
export default async function WorldPage({ params }: { params: Promise<{ slug: string }> }) {
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

  return (
    <div className="flex flex-col gap-10">
      {/* Visuellement invisible : le nom du monde est deja affiche bien en
          vue dans la barre haute (worlds/[slug]/layout.tsx, chrome persistant
          hors du controle de cette page). Un <h1> reste necessaire pour la
          semantique de page (un heading de niveau 1 par page). */}
      <h1 className="sr-only">{world.name}</h1>

      {/* Lien temporaire/jetable (KAN-36 P1-ter) : la nav pilule (qui menait
          au graphe) a ete retiree en attendant le dashboard du monde (P5) -
          le graphe deviendra un agrandissement depuis un panneau du
          dashboard, pas un onglet. En attendant, seul acces restant au
          graphe - a retirer des que le dashboard existe. */}
      <Link
        href={`/worlds/${world.slug}/graph`}
        className="self-start text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Voir le graphe →
      </Link>

      <section aria-labelledby="entities-heading" className="flex flex-col gap-6">
        <h2 id="entities-heading" className="font-heading text-lg font-medium text-foreground">
          Entités
        </h2>
        <CreateEntityForm worldId={world.id} worldSlug={world.slug} />
      </section>

      <section
        aria-labelledby="settings-heading"
        className="flex flex-col gap-6 border-t border-border pt-6"
      >
        <h2 id="settings-heading" className="font-heading text-lg font-medium text-foreground">
          Paramètres
        </h2>
        <RenameWorldForm worldId={world.id} name={world.name} />
        <DeleteWorldForm worldId={world.id} />
      </section>
    </div>
  );
}
