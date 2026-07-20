"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import cytoscape, { type Core, type NodeSingular } from "cytoscape";
import type { GraphElements } from "@/lib/graph-elements";
import {
  ENTITY_TYPES,
  entityTypeGroup,
  entityTypeLabel,
  groupedEntityTypes,
} from "@/lib/entity-schemas";

// Couleur PAR GROUPE (KAN-18, 26 types groupes en 8 familles), pas par type
// individuel : 26 teintes distinctes seraient illisibles et intenables cote
// contraste (C2.2.3). Palette categorique validee par le skill dataviz du
// projet (8 teintes, ordre fixe, jamais recycle) - valeurs colonne "dark"
// (app en dark mode par defaut) :
// `node scripts/validate_palette.js "<8 hex>" --mode dark` -> tous les
// controles passent (bande de luminosite, plancher de chroma, separation CVD,
// plancher vision normale, contraste). Le CVD reste en bande 6-8 pour les
// paires non adjacentes (disposition de graphe = "toutes paires", pas une
// liste de barres adjacentes) : legal uniquement avec un encodage secondaire
// - assure ici par les libelles textuels du filtre groupe et de la liste
// accessible (GraphAccessibleList), jamais la couleur seule.
const NODE_COLOR_BY_GROUP: Record<string, string> = {
  Personnages: "#3987e5",
  Écologie: "#008300",
  Lieux: "#d55181",
  Organisation: "#c98500",
  Magie: "#199e70",
  Lore: "#d95926",
  Objets: "#9085e9",
  Divers: "#e66767",
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
            "background-color": (node: NodeSingular) => {
              const group = entityTypeGroup(node.data("type") as string);
              return group
                ? (NODE_COLOR_BY_GROUP[group] ?? DEFAULT_NODE_COLOR)
                : DEFAULT_NODE_COLOR;
            },
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
      // animate:false - le layout "cose" anime par defaut sur plusieurs
      // requestAnimationFrame ; si le composant demonte (navigation) pendant
      // l'animation, une frame differee peut s'executer APRES cy.destroy()
      // et planter sur des internes detruits (vecu : "Cannot read properties
      // of null (reading 'notify')", reproduit par e2e/graph.spec.ts). Layout
      // synchrone = aucune frame differee possible, bug ecarte par
      // construction plutot que par un stop() fragile a synchroniser avec le
      // cleanup de l'effet.
      layout: { name: "cose", animate: false },
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
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-foreground">Filtrer par type</legend>
        {groupedEntityTypes().map(({ group, types }) => (
          <fieldset key={group} className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <legend className="w-full text-xs font-semibold text-muted-foreground">{group}</legend>
            {types.map((type) => (
              <label key={type} className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={!hiddenTypes.has(type)}
                  onChange={() => toggleType(type)}
                  className="h-4 w-4 rounded border-input focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                {entityTypeLabel(type)}
              </label>
            ))}
          </fieldset>
        ))}
      </fieldset>
      <div
        ref={containerRef}
        aria-hidden="true"
        data-testid="graph-canvas"
        className="h-[600px] w-full rounded-md border border-border bg-background"
      />
    </div>
  );
}
