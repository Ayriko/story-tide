"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_SEARCH_EVENT } from "./entity-search";

// Chip "Rechercher" du dashboard (KAN-36 P3) : ne possede aucun etat de
// recherche lui-meme, reutilise le champ deja present dans la sidebar plutot
// que d'en dupliquer un. Un seul evenement DOM prive est ecoute par deux
// composants independants (world-shell.tsx deplie la sidebar si necessaire,
// entity-search.tsx met le focus) - ce chip n'a besoin de connaitre ni l'un
// ni l'autre.
export function DashboardSearchChip() {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT))}
    >
      <Search aria-hidden="true" className="size-4" />
      Rechercher
    </Button>
  );
}
