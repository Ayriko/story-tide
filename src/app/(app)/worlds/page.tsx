import Link from "next/link";
import type { Metadata } from "next";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { listWorlds } from "@/services/world-service";
import { Card } from "@/components/ui/card";
import { Footer } from "../../footer";
import { LocalClock } from "../local-clock";
import { ScrollHint } from "../../scroll-hint";
import { TopBar } from "../top-bar";
import { UserMenu } from "../user-menu";
import { CreateWorldDialog } from "./create-world-dialog";

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

      {/* Conteneur defilant (KAN-45) : deplace depuis <main> pour que
          <footer> (rendu apres lui, hors de <main>) reste un landmark
          "contentinfo" de premier niveau. min-h-full sur <main> conserve le
          centrage vertical de la carte quand le contenu tient dans l'ecran.
          scroll-smooth : defilement fluide au clic sur ScrollHint.
          no-scrollbar (retour Aymeric) : scrollbar visuelle masquee, le
          defilement reste fonctionnel. data-scroll-container : ancre reperee
          par ScrollHint (closest()) pour cibler CE conteneur precis. */}
      <div
        data-scroll-container
        className="no-scrollbar min-h-0 flex-1 scroll-smooth overflow-y-auto"
      >
        <main id="main-content" className="flex min-h-full items-center justify-center px-4 py-12">
          <Card className="w-full max-w-2xl border-none bg-card/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="flex flex-col gap-8 px-6 py-8 sm:px-8 sm:py-10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="font-heading text-2xl font-medium text-foreground">Mes mondes</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Crée un monde pour commencer à y écrire des entrées.
                  </p>
                </div>
                <CreateWorldDialog />
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
            </div>
          </Card>
        </main>
        <ScrollHint />
        <Footer />
      </div>
    </div>
  );
}
