import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { listEntities } from "@/services/entity-service";
import { entityTypeLabel } from "@/lib/entity-schemas";
import { RenameWorldForm } from "./rename-world-form";
import { DeleteWorldForm } from "./delete-world-form";
import { CreateEntityForm } from "./create-entity-form";

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
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{world.name}</h1>
        <Link
          href={`/worlds/${world.slug}/graph`}
          className="rounded-md text-sm font-medium text-zinc-600 hover:text-zinc-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:outline-zinc-50"
        >
          Graphe
        </Link>
      </div>

      <section
        aria-labelledby="entities-heading"
        className="flex flex-col gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      >
        <h2 id="entities-heading" className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Entités
        </h2>

        <CreateEntityForm worldId={world.id} worldSlug={world.slug} />

        {entities.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Aucune fiche pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entities.map((entity) => (
              <li key={entity.id}>
                <Link
                  href={`/worlds/${world.slug}/entities/${entity.id}`}
                  className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-50"
                >
                  <span>{entity.name}</span>
                  <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {entityTypeLabel(entity.type)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="settings-heading"
        className="flex flex-col gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      >
        <h2 id="settings-heading" className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Paramètres
        </h2>
        <RenameWorldForm worldId={world.id} name={world.name} />
        <DeleteWorldForm worldId={world.id} />
      </section>
    </div>
  );
}
