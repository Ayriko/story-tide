"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import cytoscape, { type Core, type NodeSingular } from "cytoscape";
import type { GraphElements } from "@/lib/graph-elements";
import { ENTITY_TYPES, entityTypeLabel } from "@/lib/entity-schemas";

// Couleurs generiques (palette Tailwind existante) - la palette de marque
// (NAVY/MINT, cf. docs/design/reference-vvd.md) releve de la reprise visuelle
// front, hors perimetre de ce chantier (KAN-25 = le graphe uniquement).
const NODE_COLOR_BY_TYPE: Record<string, string> = {
  character: "#60a5fa",
  place: "#34d399",
  faction: "#f472b6",
  object: "#fbbf24",
  event: "#a78bfa",
};
const DEFAULT_NODE_COLOR = "#a1a1aa";

// Rendu Cytoscape (KAN-25) : canvas natif, jamais de wrapper React
// (react-cytoscapejs, fin et peu maintenu) - montage direct dans un effet,
// jamais au niveau module (cytoscape() touche le DOM immediatement, donc
// jamais appelable pendant un rendu serveur). Instance creee a CHAQUE montage
// (jamais un singleton partage) - meme regle StrictMode que l'editeur Tiptap
// (entity-editor.tsx) : reutiliser une instance entre deux montages/
// demontages corromprait son etat interne.
//
// Affordance SOURIS uniquement (clic sur un nœud, filtres inclus - un
// checkbox reste au clavier mais ne change que ce que le canvas affiche, pas
// une navigation en soi). Le chemin accessible est GraphAccessibleList,
// rendu a cote dans page.tsx.
export function GraphView({ worldSlug, elements }: { worldSlug: string; elements: GraphElements }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const router = useRouter();
  // Types masques (case cochee = visible, par defaut tout est visible) -
  // stocke l'exclusion plutot que l'inclusion pour que l'etat par defaut soit
  // un Set vide, plus simple a lire.
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const cy = cytoscape({
      container,
      elements: [...elements.nodes, ...elements.edges],
      style: [
        {
          selector: "node",
          style: {
            "background-color": (node: NodeSingular) =>
              NODE_COLOR_BY_TYPE[node.data("type") as string] ?? DEFAULT_NODE_COLOR,
            label: "data(label)",
            "font-size": 10,
            color: "#e4e4e7",
            "text-valign": "bottom",
            "text-margin-y": 6,
            width: 24,
            height: 24,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#52525b",
            "target-arrow-color": "#52525b",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
      ],
      layout: { name: "cose" },
    });
    cyRef.current = cy;

    cy.on("tap", "node", (event) => {
      const targetId = event.target.id();
      router.push(`/worlds/${worldSlug}/entities/${targetId}`);
    });

    return () => {
      cyRef.current = null;
      cy.destroy();
    };
  }, [elements, worldSlug, router]);

  // Effet separe du montage : change juste la visibilite des nœuds deja
  // presents, sans jamais recreer l'instance Cytoscape (couteux, perdrait le
  // zoom/pan courant).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    for (const type of ENTITY_TYPES) {
      cy.nodes(`[type = "${type}"]`).style("display", hiddenTypes.has(type) ? "none" : "element");
    }
  }, [hiddenTypes]);

  function toggleType(type: string) {
    setHiddenTypes((previous) => {
      const next = new Set(previous);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Filtrer par type
        </legend>
        {ENTITY_TYPES.map((type) => (
          <label
            key={type}
            className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <input
              type="checkbox"
              checked={!hiddenTypes.has(type)}
              onChange={() => toggleType(type)}
              className="h-4 w-4 rounded border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-zinc-700 dark:focus-visible:outline-zinc-50"
            />
            {entityTypeLabel(type)}
          </label>
        ))}
      </fieldset>
      <div
        ref={containerRef}
        aria-hidden="true"
        className="h-[600px] w-full rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
      />
    </div>
  );
}
