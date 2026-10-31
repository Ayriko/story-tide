"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_DEPTHS, depthLabel, type FocusDepth, type GraphFocus } from "@/lib/graph-filters";
import { cn } from "@/lib/utils";
import { SELECT_CLASS } from "../settings/types/custom-type-form";

// Carte de selection compacte (KAN-87) : un clic sur une etoile la
// selectionne et ouvre cette carte a cote d'elle (le double-clic ouvre
// directement la fiche). Isoler / Masquer sur une ligne, profondeur en petit
// select a cote, modifiable ensuite dans le panneau de filtres.
export function GraphSelectionCard({
  worldSlug,
  entity,
  onFocus,
  onClose,
}: {
  worldSlug: string;
  entity: { id: string; name: string; typeLabel: string };
  onFocus: (mode: GraphFocus["mode"], depth: FocusDepth) => void;
  onClose: () => void;
}) {
  const [depth, setDepth] = useState<FocusDepth>(1);
  const depthId = `graph-selection-depth-${entity.id}`;

  return (
    <section
      aria-labelledby="graph-selection-title"
      className="flex w-60 flex-col gap-2 rounded-md border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <h2 id="graph-selection-title" className="truncate text-sm font-medium text-foreground">
            {entity.name}
          </h2>
          <span className="shrink-0 text-xs text-muted-foreground">{entity.typeLabel}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fermer la sélection"
          onClick={onClose}
          className="-mr-1 -mt-1 size-6"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
      <Link
        href={`/worlds/${worldSlug}/entities/${entity.id}`}
        className="w-fit text-xs font-medium text-foreground underline-offset-2 hover:text-link hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Ouvrir la fiche
      </Link>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onFocus("isolate", depth)}
        >
          Isoler
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => onFocus("hide", depth)}
        >
          Masquer
        </Button>
        <label htmlFor={depthId} className="sr-only">
          Profondeur
        </label>
        <select
          id={depthId}
          value={String(depth)}
          title="Profondeur"
          onChange={(event) => {
            const next = FOCUS_DEPTHS.find((value) => String(value) === event.target.value);
            if (next !== undefined) {
              setDepth(next);
            }
          }}
          className={cn(SELECT_CLASS, "h-7 min-w-0 flex-1 px-1.5 text-xs")}
        >
          {FOCUS_DEPTHS.map((value) => (
            <option key={String(value)} value={String(value)}>
              {depthLabel(value)}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
