import Link from "next/link";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { listWorlds } from "@/services/world-service";
import { CreateWorldForm } from "./create-world-form";

export default async function WorldsPage() {
  const session = await requireSessionOrRedirect();
  const worlds = await listWorlds(session.user.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Mes mondes</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Crée un monde pour commencer à y écrire des fiches.
        </p>
      </div>

      <CreateWorldForm />

      {worlds.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Aucun monde pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {worlds.map((world) => (
            <li key={world.id}>
              <Link
                href={`/worlds/${world.slug}`}
                className="block rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-50"
              >
                {world.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
