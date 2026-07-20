import Link from "next/link";
import type { Metadata } from "next";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { listWorlds } from "@/services/world-service";
import { Card } from "@/components/ui/card";
import { LocalClock } from "../local-clock";
import { TopBar } from "../top-bar";
import { UserMenu } from "../user-menu";
import { CreateWorldForm } from "./create-world-form";

export const metadata: Metadata = {
  title: "Mes mondes",
};

// Hors monde (pas encore de sidebar/fiches a lister) : TopBar variante
// "hors monde" (Story Tide + horloge + menu utilisateur - pas de fil
// d'ariane/bouton de repli, rien a naviguer) au-dessus d'une carte flottante
// centree, sans sidebar (voir worlds/[slug]/world-shell.tsx pour la variante
// "dans un monde" - le menu utilisateur vit dans la TopBar dans les deux cas,
// jamais dans une sidebar).
export default async function WorldsPage() {
  const session = await requireSessionOrRedirect();
  const worlds = await listWorlds(session.user.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        left={
          <Link
            href="/worlds"
            className="rounded-md font-heading text-base font-semibold text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Story Tide
          </Link>
        }
        right={
          <>
            <LocalClock />
            <UserMenu name={session.user.name} email={session.user.email} />
          </>
        }
      />

      <main
        id="main-content"
        className="flex min-h-0 flex-1 items-center justify-center px-4 py-12"
      >
        <Card className="w-full max-w-2xl border-none bg-card/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex flex-col gap-8 px-6 py-8 sm:px-8 sm:py-10">
            <div>
              <h1 className="font-heading text-2xl font-medium text-foreground">Mes mondes</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Crée un monde pour commencer à y écrire des fiches.
              </p>
            </div>

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

            <CreateWorldForm />
          </div>
        </Card>
      </main>
    </div>
  );
}
