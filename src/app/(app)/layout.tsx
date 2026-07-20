import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSessionOrRedirect();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline focus:outline-2 focus:outline-ring"
      >
        Aller au contenu principal
      </a>
      <header className="border-b border-border">
        <nav
          aria-label="Navigation principale"
          className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"
        >
          <Link
            href="/worlds"
            className="rounded-md font-heading text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Story Tide
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Se déconnecter
              </Button>
            </form>
          </div>
        </nav>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
