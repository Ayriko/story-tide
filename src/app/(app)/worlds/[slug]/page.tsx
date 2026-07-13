import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { RenameWorldForm } from "./rename-world-form";
import { DeleteWorldForm } from "./delete-world-form";

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
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{world.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Aucune fiche pour le moment.
        </p>
      </div>

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
