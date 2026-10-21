"use client";

import Link from "next/link";
import { ChevronDown, Settings2, Tags } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
export function WorldTitleMenu({ worldName, worldSlug }: { worldName: string; worldSlug: string }) {
  const settings = `/worlds/${worldSlug}/settings`;
  return (
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
          className="w-56 duration-200 ease-out data-[side=bottom]:slide-in-from-top-3 motion-reduce:animate-none"
        >
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
