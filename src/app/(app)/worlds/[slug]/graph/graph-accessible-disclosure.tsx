"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccessibleGraphEntry } from "@/lib/graph-elements";
import { GraphAccessibleList } from "./graph-accessible-list";

// Disclosure (KAN-36 P5, retour Aymeric) : la liste accessible reste
// necessaire au RGAA (canvas Cytoscape = affordance souris uniquement,
// ADR-0012), mais son affichage permanent "rendait pas bien" - masquee
// derriere un bouton FERME par defaut (registre "tissage" du lexique
// produit, cf. worlds/[slug]/page.tsx TIPS), pas juste retiree : elle reste
// entierement presente dans le DOM une fois ouverte, atteignable au clavier
// (vrai <button>, aria-expanded/aria-controls - meme patron que le panneau
// de filtres de graph-view.tsx).
export function GraphAccessibleDisclosure({
  worldSlug,
  entries,
}: {
  worldSlug: string;
  entries: AccessibleGraphEntry[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="graph-accessible-body"
        onClick={() => setOpen((value) => !value)}
        className="flex w-fit items-center gap-2 text-sm font-medium text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Observer les fils
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {/* Pas de <h2> "Liste accessible" ici - redondant avec le bouton
          "Observer les fils" qui decrit deja ce que revele le disclosure ;
          <nav aria-label="Liste des liens de la constellation"> se nomme
          deja lui-meme (graph-accessible-list.tsx). */}
      {open ? (
        <div id="graph-accessible-body">
          <GraphAccessibleList worldSlug={worldSlug} entries={entries} />
        </div>
      ) : null}
    </div>
  );
}
