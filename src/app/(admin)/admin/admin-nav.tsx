"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// Sections d'administration (KAN-72) : controle segmente. Composant client
// pour une seule raison - usePathname(), sans lequel l'onglet courant ne peut
// pas etre marque (aria-current="page", et pas seulement une couleur).
const SECTIONS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
];

// "/admin" est prefixe de toutes les autres sections : egalite stricte pour
// lui, prefixe pour les autres (la fiche /admin/users/<id> reste sous
// "Utilisateurs").
function isCurrent(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections d'administration"
      className="flex items-center gap-1 self-start rounded-full bg-muted p-1"
    >
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const current = isCurrent(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              current
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground hover:bg-accent",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
