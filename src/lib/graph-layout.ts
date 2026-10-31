// Disposition de la Constellation (KAN-87, ADR-0032) : TS pur, aucune
// dependance a cytoscape ni au DOM - testable isolement (meme patron que
// graph-elements.ts).

// Bornes du zoom, partagees par l'instance Cytoscape (minZoom/maxZoom) et le
// schema Zod du cadrage sauvegarde (board-schemas.ts) : un cadrage hors de ce
// que le graphe sait afficher est refuse a la frontiere.
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export type NodePosition = { x: number; y: number };

export type PlacementPlan = {
  // preset : toutes les etoiles ont une place, rien a calculer.
  // incremental : les nouvelles sont placees autour des places connues, FIXEES.
  // full : aucune place connue (premier passage), mise en page complete.
  mode: "preset" | "incremental" | "full";
  fixed: { nodeId: string; position: NodePosition }[];
  newNodeIds: string[];
};

// Qui est nouveau, qui est fixe. Une place connue d'une entree absente du
// graphe (entree supprimee entre-temps) est ignoree.
export function planPlacement(
  nodeIds: readonly string[],
  known: ReadonlyMap<string, NodePosition>,
): PlacementPlan {
  const fixed: PlacementPlan["fixed"] = [];
  const newNodeIds: string[] = [];
  for (const nodeId of nodeIds) {
    const position = known.get(nodeId);
    if (position) {
      fixed.push({ nodeId, position: { x: position.x, y: position.y } });
    } else {
      newNodeIds.push(nodeId);
    }
  }
  let mode: PlacementPlan["mode"] = "incremental";
  if (newNodeIds.length === 0) {
    mode = "preset";
  } else if (fixed.length === 0) {
    mode = "full";
  }
  return { mode, fixed, newNodeIds };
}

// Options fcose d'un plan incremental ou complet. animate:false : mise en
// page synchrone, aucune frame differee apres un demontage (meme raison que
// l'ancien cose, ADR-0012). fit:false : le cadrage est decide par l'appelant
// (cadrage enregistre ou ajustement a l'ecran), jamais par la mise en page.
export function fcoseOptions(plan: PlacementPlan) {
  return {
    name: "fcose",
    animate: false,
    randomize: true,
    fit: false,
    nodeSeparation: 120,
    idealEdgeLength: () => 120,
    fixedNodeConstraint: plan.mode === "incremental" ? plan.fixed : undefined,
  } as const;
}

export type ViewExtent = { x1: number; y1: number; x2: number; y2: number };

// Zone visible du cadrage (coordonnees du modele, cy.extent()) : une etoile
// placee automatiquement n'en sort jamais (KAN-87, retour de recette). Elle
// est ramenee a l'interieur, en retrait de `insetRatio` de chaque bord pour
// ne pas coller au cadre.
export function clampIntoView(
  position: NodePosition,
  extent: ViewExtent,
  insetRatio = 0.1,
): NodePosition {
  const insetX = (extent.x2 - extent.x1) * insetRatio;
  const insetY = (extent.y2 - extent.y1) * insetRatio;
  return {
    x: Math.min(Math.max(position.x, extent.x1 + insetX), extent.x2 - insetX),
    y: Math.min(Math.max(position.y, extent.y1 + insetY), extent.y2 - insetY),
  };
}

// Cadrage « ajuster a l'ecran » (KAN-87) : comme cy.fit, mais dans la zone
// utile du canvas, sous une bande haute reservee (titre du monde pose sur le
// canvas, en haut a gauche) - aucune etoile ne passe sous le titre. Le zoom
// est multiplie par zoomFactor (recul d'un cran), plafonne par maxZoom et
// borne par minZoom ; le graphe est centre dans la zone utile.
export function fitViewport({
  bounds,
  width,
  height,
  padding,
  topInset,
  minZoom,
  maxZoom,
  zoomFactor = 1,
}: {
  bounds: ViewExtent;
  width: number;
  height: number;
  padding: number;
  topInset: number;
  minZoom: number;
  maxZoom: number;
  zoomFactor?: number;
}): { zoom: number; pan: NodePosition } {
  const usableWidth = Math.max(width - 2 * padding, 1);
  const usableHeight = Math.max(height - topInset - 2 * padding, 1);
  const graphWidth = Math.max(bounds.x2 - bounds.x1, 1);
  const graphHeight = Math.max(bounds.y2 - bounds.y1, 1);
  const fitted = Math.min(usableWidth / graphWidth, usableHeight / graphHeight) * zoomFactor;
  const zoom = Math.min(maxZoom, Math.max(minZoom, fitted));
  const centerX = (bounds.x1 + bounds.x2) / 2;
  const centerY = (bounds.y1 + bounds.y2) / 2;
  return {
    zoom,
    pan: {
      x: width / 2 - centerX * zoom,
      y: topInset + (height - topInset) / 2 - centerY * zoom,
    },
  };
}
