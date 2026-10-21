import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { DeleteWorldForm } from "../delete-world-form";
import { RenameWorldForm } from "../rename-world-form";

// Onglet « Général » (KAN-81) : les deux formulaires de la boite de dialogue
// des parametres, reutilises tels quels (renommer redirige vers le monde,
// supprimer vers /worlds - comportement inchange).
export default async function WorldSettingsGeneralPage({
  params,
}: {
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

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="world-rename-heading" className="flex flex-col gap-3">
        <h2 id="world-rename-heading" className="font-heading text-lg font-medium text-foreground">
          Nom du monde
        </h2>
        <RenameWorldForm worldId={world.id} name={world.name} />
      </section>
      <section
        aria-labelledby="world-danger-heading"
        className="flex flex-col gap-3 border-t border-border pt-6"
      >
        <h2 id="world-danger-heading" className="font-heading text-lg font-medium text-foreground">
          Zone de danger
        </h2>
        <div>
          <DeleteWorldForm worldId={world.id} />
        </div>
      </section>
    </div>
  );
}
