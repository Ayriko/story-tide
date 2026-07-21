"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import cytoscape, { type Core, type NodeSingular } from "cytoscape";
import { ChevronDown } from "lucide-react";
import type { GraphElements } from "@/lib/graph-elements";
import {
  ENTITY_TYPES,
  entityTypeGroup,
  entityTypeLabel,
  groupedEntityTypes,
} from "@/lib/entity-schemas";
import { cn } from "@/lib/utils";

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
// Accent MINT (--primary, reference-vvd.md §2) : survol de noeud uniquement -
// le tap navigue deja (pas d'etat "selectionne" persistant a distinguer du
// hover, cf. commentaire sur cy.on("tap", ...) plus bas).
const HOVER_COLOR = "#1fb39a";
// Halo sombre (--background, NAVY) derriere le libelle : lisibilite du texte
// quel que soit le noeud/fond survole, sans dependre de la couleur du noeud.
const LABEL_HALO_COLOR = "#122a3a";

// Rendu Cytoscape (KAN-25) : canvas natif, jamais de wrapper React
// (react-cytoscapejs, fin et peu maintenu) - montage direct dans un effet,
// jamais au niveau module (cytoscape() touche le DOM immediatement, donc
// jamais appelable pendant un rendu serveur). Instance creee a CHAQUE montage
// (jamais un singleton partage) - meme regle StrictMode que l'editeur Tiptap
// (entity-editor.tsx) : reutiliser une instance entre deux montages/
// demontages corromprait son etat interne.
//
// Affordance SOURIS uniquement (clic sur un nœud, filtres inclus - une chip
// reste au clavier mais ne change que ce que le canvas affiche, pas une
// navigation en soi). Le chemin accessible est GraphAccessibleList, rendu a
// cote dans page.tsx.
export function GraphView({
  worldSlug,
  elements,
  showFilters = true,
  canvasClassName = "h-[600px] w-full rounded-md border border-border",
}: {
  worldSlug: string;
  elements: GraphElements;
  // Dashboard (KAN-36 P3) : panneau miniature sans le fieldset de filtres
  // (deja disponible en entier sur /graph, atteint via "Agrandir" - pas de
  // duplication du chemin accessible ici). /graph garde le defaut `true`.
  showFilters?: boolean;
  // Hauteur du canvas parametrable (dashboard = panneau plus bas que la page
  // /graph dediee) - defaut inchange pour /graph.
  canvasClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const router = useRouter();
  // Types masques (chip pressee = visible, par defaut tout est visible) -
  // stocke l'exclusion plutot que l'inclusion pour que l'etat par defaut soit
  // un Set vide, plus simple a lire.
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(new Set());
  // Panneau de filtres replie/deplie (KAN-36 P5b) - FERME par defaut (retour
  // Aymeric : ne doit pas encombrer la vue a l'ouverture), purement visuel
  // (ne change rien a hiddenTypes).
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Police reelle chargee par next/font (layout.tsx, variable --font-inter)
    // - lue au montage plutot que hardcodee : le canvas Cytoscape ne sait pas
    // resoudre var(--font-inter) lui-meme (ctx.font n'accepte pas les custom
    // properties CSS), donc on recupere la valeur calculee une fois et on la
    // passe telle quelle.
    const interFontFamily =
      getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim() ||
      "Inter, sans-serif";

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
            "font-family": interFontFamily,
            "font-size": 10,
            color: "#edf2f2",
            "text-valign": "bottom",
            "text-margin-y": 6,
            // Halo (text-outline) : le libelle reste lisible quel que soit le
            // fond survole/la couleur du noeud - encodage textuel du type,
            // jamais la couleur seule (C2.2.3, cf. commentaire NODE_COLOR_BY_GROUP).
            "text-outline-color": LABEL_HALO_COLOR,
            "text-outline-width": 2,
            width: 24,
            height: 24,
            "border-width": 0,
          },
        },
        {
          // Survol (KAN-36 P5c) : Cytoscape n'a pas de pseudo-classe :hover,
          // classe basculee via cy.on("mouseover"/"mouseout", ...) ci-dessous.
          selector: "node.is-hovered",
          style: {
            "border-width": 2,
            "border-color": HOVER_COLOR,
            color: HOVER_COLOR,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#52525b",
            "line-opacity": 0.6,
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
      // padding eleve (KAN-36 P5, retour Aymeric "reduit le zoom initial") -
      // "cose" fait un fit:true implicite : plus de marge autour du graphe =
      // zoom de depart plus faible, sans logique de zoom manuelle a ecrire.
      layout: { name: "cose", animate: false, padding: 120 },
    });
    cyRef.current = cy;

    cy.on("tap", "node", (event) => {
      const targetId = event.target.id();
      router.push(`/worlds/${worldSlug}/entities/${targetId}`);
    });
    cy.on("mouseover", "node", (event) => {
      event.target.addClass("is-hovered");
    });
    cy.on("mouseout", "node", (event) => {
      event.target.removeClass("is-hovered");
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

  // "Tout"/"Rien" par groupe (KAN-36 P5b) - bascule tous les types d'un groupe
  // d'un coup, sur le meme Set hiddenTypes (aucune logique de filtrage
  // nouvelle, cf. l'effet separe plus haut qui applique deja le Set a chaque
  // changement).
  function setGroupHidden(types: readonly string[], hidden: boolean) {
    setHiddenTypes((previous) => {
      const next = new Set(previous);
      for (const type of types) {
        if (hidden) {
          next.add(type);
        } else {
          next.delete(type);
        }
      }
      return next;
    });
  }

  return (
    <div className="relative flex flex-col gap-3">
      {showFilters ? (
        // Panneau flottant en overlay (KAN-36 P5b) - affordance de FILTRAGE du
        // canvas, pas de navigation : le chemin clavier de navigation reste
        // GraphAccessibleList, rendu a cote dans page.tsx (ADR-0012 inchange).
        <div className="absolute right-2 top-2 z-10 flex w-44 flex-col overflow-hidden rounded-md border border-border bg-card/90 shadow-lg backdrop-blur-sm">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="graph-filters-body"
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex items-center justify-between gap-2 px-2 py-1 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Filtres
            <ChevronDown
              aria-hidden="true"
              className={cn("size-3.5 shrink-0 transition-transform", filtersOpen && "rotate-180")}
            />
          </button>
          {filtersOpen ? (
            <div
              id="graph-filters-body"
              className="flex max-h-56 flex-col gap-2 overflow-y-auto border-t border-border px-2 py-1.5"
            >
              {groupedEntityTypes().map(({ group, types }) => (
                <fieldset key={group} className="flex flex-col gap-1">
                  <legend className="flex w-full items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">{group}</span>
                    <span className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setGroupHidden(types, false)}
                        className="text-muted-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        Tout
                      </button>
                      <span aria-hidden="true" className="text-muted-foreground">
                        /
                      </span>
                      <button
                        type="button"
                        onClick={() => setGroupHidden(types, true)}
                        className="text-muted-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        Rien
                      </button>
                    </span>
                  </legend>
                  <div className="flex flex-wrap gap-1">
                    {types.map((type) => {
                      const hidden = hiddenTypes.has(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          aria-pressed={!hidden}
                          onClick={() => toggleType(type)}
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            hidden
                              ? "border-border bg-transparent text-muted-foreground hover:bg-accent"
                              : "border-primary/40 bg-primary/15 text-primary",
                          )}
                        >
                          {entityTypeLabel(type)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {/* graph-canvas-backdrop (globals.css) : fond assombri + grille
          discrete legerement floutee, via ::before - jamais un filter:blur
          direct sur ce conteneur, qui flouterait aussi le <canvas> reel que
          Cytoscape y insere. */}
      <div
        ref={containerRef}
        aria-hidden="true"
        data-testid="graph-canvas"
        className={cn("graph-canvas-backdrop", canvasClassName)}
      />
    </div>
  );
}
