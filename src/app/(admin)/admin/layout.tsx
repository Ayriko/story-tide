import Link from "next/link";
import { requireAdminOrNotFound } from "@/lib/auth-session";
import { Footer } from "../../footer";
import { ShellBackground } from "../../shell-background";
import { LocalClock } from "../../(app)/local-clock";
import { TopBar } from "../../(app)/top-bar";
import { UserMenu } from "../../(app)/user-menu";
import { adminMetadata } from "./admin-metadata";
import { AdminNav } from "./admin-nav";

// Jamais de `export const metadata` statique sous /admin : voir admin-metadata.ts.
export function generateMetadata() {
  return adminMetadata();
}

// Groupe de routes (admin) SEPARE de (app) (KAN-72, ADR-0029) : le layout
// (app) redirige l'anonyme vers /login, ce qui distinguerait "/admin existe"
// de "/admin n'existe pas". Ici, anonyme et compte standard recoivent la 404
// de Next, la meme que pour n'importe quelle route inexistante. La coquille
// (fond, lien d'evitement) est donc reprise de (app)/layout.tsx.
//
// La garde est appelee ici ET dans chaque page : Next peut rendre layout et
// page en parallele, un layout seul ne protege pas la page.
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAdminOrNotFound();

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <ShellBackground />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline focus:outline-2 focus:outline-ring"
      >
        Aller au contenu principal
      </a>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <TopBar
          left={
            <nav
              aria-label="Fil d'ariane"
              className="flex items-center gap-1.5 font-heading text-base font-semibold"
            >
              <Link
                href="/worlds"
                className="text-foreground hover:text-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Story Tide
              </Link>
              <span aria-hidden="true" className="text-muted-foreground">
                /
              </span>
              <Link
                href="/admin"
                className="text-foreground hover:text-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Administration
              </Link>
            </nav>
          }
          right={
            <>
              <LocalClock />
              <UserMenu name={session.user.name} email={session.user.email} />
            </>
          }
        />

        {/* relative : obligatoire sur le conteneur defilant (BUG-014, voir
            (app)/worlds/page.tsx). */}
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {/* min-h-full + flex-1 sur <main> : sur une page courte (liste de
              quelques comptes), le pied de page reste en bas de l'ecran au
              lieu de remonter sous le contenu ; sur une page longue il est
              pousse a la suite. */}
          <div className="flex min-h-full flex-col">
            <main
              id="main-content"
              className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6"
            >
              <AdminNav />
              {children}
            </main>
            <Footer showAdminLink />
          </div>
        </div>
      </div>
    </div>
  );
}
