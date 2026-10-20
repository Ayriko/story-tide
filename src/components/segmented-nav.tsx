"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Controle segmente de navigation entre sous-routes (extrait d'AdminNav,
// KAN-81 : partage /admin et /worlds/[slug]/settings). Composant client pour
// une seule raison - usePathname(), sans lequel l'onglet courant ne peut pas
// etre marque (aria-current="page", et pas seulement une couleur).
export type SegmentedNavSection = {
  href: string;
  label: string;
  icon: LucideIcon;
  // true : section courante seulement sur egalite stricte (la section racine,
  // prefixe de toutes les autres) ; sinon prefixe (une sous-page reste sous
  // sa section).
  exact?: boolean;
};

function isCurrent({ href, exact }: SegmentedNavSection, pathname: string): boolean {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function SegmentedNav({
  ariaLabel,
  sections,
}: {
  ariaLabel: string;
  sections: readonly SegmentedNavSection[];
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className="flex items-center gap-1 self-start rounded-full bg-muted p-1"
    >
      {sections.map((section) => {
        const { href, label, icon: Icon } = section;
        const current = isCurrent(section, pathname);
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
