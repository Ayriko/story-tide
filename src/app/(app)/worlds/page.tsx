import Link from "next/link";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { listWorlds } from "@/services/world-service";
import { Card } from "@/components/ui/card";
import { CreateWorldForm } from "./create-world-form";

export default async function WorldsPage() {
  const session = await requireSessionOrRedirect();
  const worlds = await listWorlds(session.user.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Mes mondes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crée un monde pour commencer à y écrire des fiches.
        </p>
      </div>

      <CreateWorldForm />

      {worlds.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun monde pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {worlds.map((world) => (
            <li key={world.id}>
              <Link
                href={`/worlds/${world.slug}`}
                className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Card className="px-4 py-3 transition-colors hover:bg-accent">
                  <span className="font-heading text-sm font-medium text-foreground">
                    {world.name}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
