import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/login", label: "Connexion", key: "login" as const },
  { href: "/register", label: "Inscription", key: "register" as const },
];

// Ce sont deux pages distinctes (vraie navigation, pas un panneau qui change
// sans rechargement) - `aria-current="page"` est le patron correct, pas
// role="tab" (qui impliquerait un widget avec navigation clavier flechee que
// ce composant n'implemente pas).
export function AuthTabs({ active }: { active: "login" | "register" }) {
  return (
    <nav aria-label="Connexion ou inscription" className="flex gap-1 rounded-lg bg-muted/50 p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
