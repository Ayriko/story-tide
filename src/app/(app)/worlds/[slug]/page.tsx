import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { listEntities } from "@/services/entity-service";
import { RenameWorldForm } from "./rename-world-form";
import { DeleteWorldForm } from "./delete-world-form";
import { CreateEntityForm } from "./create-entity-form";
import { EntitySearch } from "./entity-search";

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

  const entities = await listEntities(session.user.id, world.id);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium text-foreground">{world.name}</h1>
        <Link
          href={`/worlds/${world.slug}/graph`}
          className="rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Graphe
        </Link>
      </div>

      <section
        aria-labelledby="entities-heading"
        className="flex flex-col gap-6 border-t border-border pt-6"
      >
        <h2 id="entities-heading" className="font-heading text-lg font-medium text-foreground">
          Entités
        </h2>

        <CreateEntityForm worldId={world.id} worldSlug={world.slug} />

        <EntitySearch
          worldId={world.id}
          worldSlug={world.slug}
          initialEntities={entities.map(({ id, name, type }) => ({ id, name, type }))}
        />
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
