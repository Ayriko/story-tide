"use client";

import Link from "next/link";
import { ChevronDown, Settings2, Tags } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EntityTypeGroup } from "@/lib/entity-schemas";
import { GROUP_DEFAULT_ICON } from "@/lib/entity-types";
import { GROUP_TOKEN } from "@/lib/sky-theme";
import { EntityTypeIcon } from "./entity-type-icon";

// Titre du monde + menu (KAN-81, retour Aymeric) : remplace l'engrenage de la
// barre haute sur la page d'un monde. Seul le chevron est un bouton (le titre
// reste un titre) ; il est HORS du <h1>, dont le texte reste le seul nom du
// monde. Nom accessible explicite, Radix annonce le menu
// (aria-haspopup/expanded).
//
// Ouverture : 200 ms (glissement depuis le chevron + fondu + leger zoom) au
// lieu des 100 ms du composant partage, trop brusques a l'oeil - surcharge
// locale, dropdown-menu.tsx inchange (menu utilisateur intact). Le chevron
// pivote a l'ouverture. Aucune animation si l'utilisateur a demande a
// reduire les animations (motion-reduce, RGAA 13.8).
//
// Compteurs (KAN-85) : sous le titre, le seul total, petit et attenue
// (--sky-total) ; dans le menu, la legende du ciel - une ligne par groupe
// non vide : pastille de la couleur de ses etoiles (meme jeton que le ciel),
// icone du groupe, nom et nombre. La couleur n'est jamais seule (icone +
// nom). Vraie liste, AU-DESSUS du menu dans le meme panneau mais HORS du
// role="menu" (ARIA strict : un menu ne contient que des elements de menu,
// groupes et separateurs). Le panneau Radix perd donc son role (et les
// attributs propres a un menu) ; le role="menu" passe sur le seul bloc des
// actions, que la navigation aux fleches de Radix continue de parcourir.
export function WorldTitleMenu({
  worldName,
  worldSlug,
  total = 0,
  legend = [],
}: {
  worldName: string;
  worldSlug: string;
  total?: number;
  legend?: { group: EntityTypeGroup; count: number }[];
}) {
  const settings = `/worlds/${worldSlug}/settings`;
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <h1 className="font-heading text-4xl font-medium text-foreground">{worldName}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu du monde"
              className="group inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-accent data-[state=open]:text-foreground"
            >
              <ChevronDown
                aria-hidden="true"
                className="size-5 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180 motion-reduce:transition-none"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            role={undefined}
            aria-orientation={undefined}
            aria-labelledby={undefined}
            className="w-64 duration-200 ease-out data-[side=bottom]:slide-in-from-top-3 motion-reduce:animate-none"
          >
            {legend.length > 0 ? (
              <>
                <ul aria-label="Légende du ciel" className="flex flex-col py-1">
                  {legend.map(({ group, count }) => (
                    <li key={group} className="flex items-center gap-2 px-2 py-1 text-sm">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(--sky-star-${GROUP_TOKEN[group]})` }}
                      />
                      <EntityTypeIcon icon={GROUP_DEFAULT_ICON[group]} className="size-4" />
                      <span className="min-w-0 flex-1 truncate text-foreground">{group}</span>
                      <span className="tabular-nums text-muted-foreground">{count}</span>
                    </li>
                  ))}
                </ul>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <div role="menu" aria-label="Menu du monde" aria-orientation="vertical">
              <DropdownMenuItem asChild>
                <Link href={settings}>
                  <Settings2 aria-hidden="true" />
                  Paramètres du monde
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`${settings}/types`}>
                  <Tags aria-hidden="true" />
                  Types d&apos;entrées
                </Link>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {total > 0 ? (
        <p className="text-xs text-(--sky-total)">
          {total} {total === 1 ? "entrée" : "entrées"}
        </p>
      ) : null}
    </div>
  );
}
