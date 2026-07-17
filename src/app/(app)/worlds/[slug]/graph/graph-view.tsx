"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import cytoscape, { type NodeSingular } from "cytoscape";
import type { GraphElements } from "@/lib/graph-elements";

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
// Affordance SOURIS uniquement (clic sur un nœud) - le canvas ne peut pas
// exposer d'elements individuels au clavier/lecteur d'ecran. Le chemin
// accessible est une liste separee, ajoutee a l'etape suivante (RGAA).
export function GraphView({ worldSlug, elements }: { worldSlug: string; elements: GraphElements }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

    cy.on("tap", "node", (event) => {
      const targetId = event.target.id();
      router.push(`/worlds/${worldSlug}/entities/${targetId}`);
    });

    return () => {
      cy.destroy();
    };
  }, [elements, worldSlug, router]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="h-[600px] w-full rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
    />
  );
}
