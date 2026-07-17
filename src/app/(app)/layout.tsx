import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { requireSessionOrRedirect } from "@/lib/auth-session";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSessionOrRedirect();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-zinc-950 focus:outline focus:outline-2 focus:outline-zinc-950 dark:focus:bg-zinc-900 dark:focus:text-zinc-50"
      >
        Aller au contenu principal
      </a>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav
          aria-label="Navigation principale"
          className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"
        >
          <Link
            href="/worlds"
            className="rounded-md text-sm font-semibold text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:text-zinc-50 dark:focus-visible:outline-zinc-50"
          >
            Story Tide
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{session.user.email}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md text-sm font-medium text-zinc-600 hover:text-zinc-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:outline-zinc-50"
              >
                Se déconnecter
              </button>
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
