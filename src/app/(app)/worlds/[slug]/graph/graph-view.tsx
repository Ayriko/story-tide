"use client";

import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from "react";
import cytoscape, {
  type Core,
  type EdgeSingular,
  type ElementDefinition,
  type NodeSingular,
  type SingularElementArgument,
} from "cytoscape";
import edgehandles, { type EdgeHandlesInstance } from "cytoscape-edgehandles";
import fcose from "cytoscape-fcose";
import { saveNodePositionsAction, saveViewportAction } from "@/actions/board";
import type { BoardPosition, BoardViewport } from "@/lib/board-schemas";
import { MAX_POSITIONS_PER_CALL } from "@/lib/board-schemas";
import { diffGraphElements, isEmptyDiff } from "@/lib/graph-diff";
import type { GraphElements } from "@/lib/graph-elements";
import type { GraphVisibility } from "@/lib/graph-filters";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampIntoView,
  fcoseOptions,
  fitViewport,
  planPlacement,
  type NodePosition,
} from "@/lib/graph-layout";
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
// Accent periwinkle (--primary, ADR-0027) : survol et selection d'une etoile.
// Cytoscape ne lit pas les variables CSS (tableau `style:` reserve par
// ADR-0012) - constante dupliquee depuis --primary, a resynchroniser
// manuellement si le token change encore.
const HOVER_COLOR = "#667ec7";
// Halo sombre (--background, NAVY) derriere le libelle : lisibilite du texte
// quel que soit le noeud/fond survole, sans dependre de la couleur du noeud.
const LABEL_HALO_COLOR = "#122a3a";

// Poignee de liaison (KAN-87) : un noeud technique pose au-dessus de l'etoile
// survolee (edgehandles v4 n'en fournit plus). Ce n'est jamais une entree :
// exclu du diff, des positions, des filtres et des sauvegardes.
const LINK_HANDLE_ID = "__link-handle";
const LINK_HANDLE_OFFSET_Y = -22;
const HANDLE_HIDE_DELAY_MS = 250;
const POSITIONS_SAVE_DELAY_MS = 400;
const VIEWPORT_SAVE_DELAY_MS = 800;
const ZOOM_STEP = 1.25;
const FIT_PADDING = 80;
// Plafond du zoom apres « ajuster » (retour de recette) : un petit monde ne
// s'affiche jamais en gros plan.
const FIT_MAX_ZOOM = 1.2;
// Bande haute du canvas occupee par la barre haute flottante puis le titre du
// monde et ses compteurs (constellation.tsx) : exclue du cadrage « ajuster ».
const TITLE_RESERVED_HEIGHT = 150;
// Libelles d'arete visibles sans survol a partir de ce zoom (retour de
// recette : 1) ; en dessous, seulement au survol de l'arete ou d'une de ses
// etoiles. Seuil
// applique par une classe et PAS par min-zoomed-font-size : Cytoscape arrondit
// ce calcul a la puissance de 2 superieure et le multiplie par le
// devicePixelRatio (verifie dans cytoscape.esm.mjs, eleTextBiggerThanMin) -
// le seuil reel varierait d'un ecran a l'autre.
const EDGE_LABEL_MIN_ZOOM = 1;
// Milieu d'arete compte comme obstacle pour la carte de selection.
const EDGE_OBSTACLE_SIZE = 24;

let extensionsRegistered = false;
function registerExtensions() {
  if (!extensionsRegistered) {
    cytoscape.use(fcose);
    cytoscape.use(edgehandles);
    extensionsRegistered = true;
  }
}

// Une entree du monde porte toujours data(typeKey) ; une arete du monde,
// data(kind). Poignee, fantomes et apercus d'edgehandles n'en ont pas.
function isEntityNode(element: SingularElementArgument): boolean {
  return element.isNode() && element.data("typeKey") !== undefined;
}
function isWorldEdge(element: SingularElementArgument): boolean {
  return element.isEdge() && element.data("kind") !== undefined;
}
function entityNodes(cy: Core): NodeSingular[] {
  const nodes: NodeSingular[] = [];
  cy.nodes().forEach((node) => {
    if (isEntityNode(node)) {
      nodes.push(node);
    }
  });
  return nodes;
}
// Meme selection, en collection Cytoscape (cadrage).
function entityCollection(cy: Core, visibleOnly = false) {
  return cy.nodes().filter((node) => isEntityNode(node) && (!visibleOnly || node.visible()));
}

function currentPositions(cy: Core): BoardPosition[] {
  return entityNodes(cy).map((node) => ({
    entityId: node.id(),
    x: node.position("x"),
    y: node.position("y"),
  }));
}

function clampZoom(level: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
}

// Ajuster a l'ecran puis reculer d'un cran, sans depasser FIT_MAX_ZOOM
// (retour de recette : ciel aere), sous la bande haute reservee au titre du
// monde (aucune etoile sous le titre).
function fitWithBreathingRoom(cy: Core, visibleOnly = false) {
  const nodes = entityCollection(cy, visibleOnly);
  if (nodes.empty()) {
    return;
  }
  const box = nodes.boundingBox({ includeLabels: true });
  const view = fitViewport({
    bounds: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 },
    width: cy.width(),
    height: cy.height(),
    padding: FIT_PADDING,
    topInset: TITLE_RESERVED_HEIGHT,
    minZoom: MIN_ZOOM,
    maxZoom: FIT_MAX_ZOOM,
    zoomFactor: 1 / ZOOM_STEP,
  });
  cy.viewport({ zoom: view.zoom, pan: view.pan });
}

// Visibilite (filtres, KAN-87) : on itere sur les elements et on compare les
// ids - jamais de selecteur chaine construit a partir d'une donnee.
function applyVisibility(cy: Core, visibility: GraphVisibility) {
  cy.batch(() => {
    cy.nodes().forEach((node) => {
      if (isEntityNode(node)) {
        node.style("display", visibility.nodeIds.has(node.id()) ? "element" : "none");
      }
    });
    cy.edges().forEach((edge) => {
      if (isWorldEdge(edge)) {
        edge.style("display", visibility.edgeIds.has(edge.id()) ? "element" : "none");
      }
    });
  });
}

// Classe de zoom posee sur toutes les aretes du monde (bascule en lot).
function syncZoomedLabels(cy: Core) {
  const zoomedIn = cy.zoom() >= EDGE_LABEL_MIN_ZOOM;
  cy.batch(() => {
    cy.edges().forEach((edge) => {
      if (isWorldEdge(edge)) {
        edge.toggleClass("is-zoomed-in", zoomedIn);
      }
    });
  });
}

function showAll(cy: Core) {
  cy.batch(() => {
    cy.elements().forEach((element) => {
      if (isEntityNode(element) || isWorldEdge(element)) {
        element.style("display", "element");
      }
    });
  });
}

// Place les etoiles sans position (fcose, positions connues FIXEES) et rend
// les positions a sauvegarder. Mise en page sur TOUTES les entrees, filtres
// leves le temps du calcul (synchrone, aucune frame affichee entre deux).
// Placement incremental : une nouvelle etoile reste DANS la zone visible du
// cadrage courant (pres de ses voisins quand fcose l'y met), jamais hors champ.
function placeNewNodes(
  cy: Core,
  known: ReadonlyMap<string, NodePosition>,
  visibility: GraphVisibility,
): BoardPosition[] {
  const nodes = entityNodes(cy);
  const plan = planPlacement(
    nodes.map((node) => node.id()),
    known,
  );
  if (plan.mode === "preset") {
    return [];
  }
  showAll(cy);
  const worldElements = cy
    .elements()
    .filter((element) => isEntityNode(element) || isWorldEdge(element));
  worldElements.layout(fcoseOptions(plan)).run();
  if (plan.mode === "incremental") {
    const extent = cy.extent();
    for (const nodeId of plan.newNodeIds) {
      const node = cy.getElementById(nodeId);
      node.position(clampIntoView(node.position(), extent));
    }
  }
  applyVisibility(cy, visibility);
  const placed = new Set(plan.newNodeIds);
  return currentPositions(cy).filter((position) => placed.has(position.entityId));
}

export type GraphViewHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  getPositions: () => BoardPosition[];
  applyPositions: (positions: BoardPosition[]) => void;
  // Mise en page complete (« Reorganiser ») : rend la nouvelle disposition.
  reorganize: () => BoardPosition[];
  // Fin de la boite de liaison : les deux etoiles cessent d'etre mises en avant.
  clearLinkHighlight: () => void;
};

// Boite englobante a l'ecran (pixels du conteneur).
export type ScreenBox = { x1: number; y1: number; x2: number; y2: number };

// Ancre de la carte de selection : l'etoile selectionnee et ce qu'il ne faut
// pas couvrir autour (autres etoiles visibles, milieux d'aretes visibles).
export type SelectionAnchor = { box: ScreenBox; obstacles: ScreenBox[] };

type E2EConstellationHook = {
  nodes: () => {
    id: string;
    label: string;
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  }[];
};

declare global {
  interface Window {
    // Crochet de lecture pour Playwright UNIQUEMENT (KAN-87) : pose si et
    // seulement si NEXT_PUBLIC_E2E_HOOKS === "1" (webServer de
    // playwright.config.ts). Next inline la variable au build : absente en
    // production, la branche est eliminee du bundle.
    __storyTideConstellation?: E2EConstellationHook;
  }
}

// Rendu Cytoscape (KAN-25, KAN-87) : canvas natif, jamais de wrapper React.
// Instance creee UNE fois par montage (jamais un singleton partage - meme
// regle StrictMode que l'editeur Tiptap) ; quand les elements changent
// (router.refresh apres une creation), elle est mise a jour par difference
// (graph-diff.ts) : aucune etoile existante ne bouge, les nouvelles sont
// placees autour (graph-layout.ts). La disposition est sauvegardee au lacher
// d'une etoile et en fin de mouvement du cadrage, sans aucun re-rendu serveur.
//
// Affordance SOURIS (ADR-0012) : le chemin clavier est la liste accessible et
// la section « Relations » de la fiche.
export function GraphView({
  ref,
  worldSlug,
  elements,
  initialViewport,
  initialPositions,
  visibility,
  selectedNodeId,
  onSelectNode,
  onOpenNode,
  onLinkRequest,
  onSaveError,
  onSelectionAnchor,
  className,
}: {
  ref?: Ref<GraphViewHandle>;
  worldSlug: string;
  elements: GraphElements;
  initialViewport: BoardViewport | null;
  initialPositions: BoardPosition[];
  visibility: GraphVisibility;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onOpenNode: (nodeId: string) => void;
  onLinkRequest: (sourceId: string, targetId: string) => void;
  onSaveError: (message: string) => void;
  // Position a l'ecran de l'etoile selectionnee, a chaque deplacement, zoom ou
  // panoramique (null : pas de selection).
  onSelectionAnchor: (anchor: SelectionAnchor | null) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const linkEndsRef = useRef<NodeSingular[]>([]);
  // Derniers elements appliques a l'instance : base du diff.
  const appliedElementsRef = useRef<GraphElements | null>(null);
  const pendingPositionsRef = useRef(new Map<string, BoardPosition>());

  const reportSaveError = useEffectEvent((message: string) => onSaveError(message));
  const selectNode = useEffectEvent((nodeId: string | null) => onSelectNode(nodeId));
  const openNode = useEffectEvent((nodeId: string) => onOpenNode(nodeId));
  const requestLink = useEffectEvent((sourceId: string, targetId: string) =>
    onLinkRequest(sourceId, targetId),
  );
  const readInitial = useEffectEvent(() => ({
    elements,
    initialViewport,
    initialPositions,
    visibility,
  }));
  const readVisibility = useEffectEvent(() => visibility);
  const reportAnchor = useEffectEvent((anchor: SelectionAnchor | null) =>
    onSelectionAnchor(anchor),
  );

  // Sauvegarde fire-and-forget : un echec n'annule jamais la position
  // affichee, il est signale (toast discret) et trace.
  const persistPositions = useEffectEvent((positions: BoardPosition[]) => {
    for (let start = 0; start < positions.length; start += MAX_POSITIONS_PER_CALL) {
      const chunk = positions.slice(start, start + MAX_POSITIONS_PER_CALL);
      saveNodePositionsAction(worldSlug, chunk)
        .then((result) => {
          if (!result.ok) {
            reportSaveError(result.error);
          }
        })
        .catch((error: unknown) => {
          console.error("[graph-view] Sauvegarde des positions injoignable :", error);
          reportSaveError("Sauvegarde de la disposition impossible pour le moment.");
        });
    }
  });
  const persistViewport = useEffectEvent((viewport: BoardViewport) => {
    saveViewportAction(worldSlug, viewport)
      .then((result) => {
        if (!result.ok) {
          reportSaveError(result.error);
        }
      })
      .catch((error: unknown) => {
        console.error("[graph-view] Sauvegarde du cadrage injoignable :", error);
        reportSaveError("Sauvegarde de la disposition impossible pour le moment.");
      });
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    registerExtensions();
    const initial = readInitial();
    const known = new Map(
      initial.initialPositions.map(({ entityId, x, y }) => [entityId, { x, y }]),
    );

    // Police reelle chargee par next/font (layout.tsx, variable --font-inter)
    // - lue au montage plutot que hardcodee : le canvas Cytoscape ne sait pas
    // resoudre var(--font-inter) lui-meme.
    const interFontFamily =
      getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim() ||
      "Inter, sans-serif";

    const definitions: ElementDefinition[] = [
      ...initial.elements.nodes.map((node) => {
        const position = known.get(node.data.id);
        return position ? { data: node.data, position: { ...position } } : { data: node.data };
      }),
      ...initial.elements.edges,
    ];

    const cy = cytoscape({
      container,
      elements: definitions,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // Positions posees telles quelles (preset) ; les nouvelles sont
      // placees juste apres par placeNewNodes.
      layout: { name: "preset", fit: false },
      style: [
        {
          selector: "node",
          style: {
            "background-color": (node: NodeSingular) =>
              NODE_COLOR_BY_GROUP[node.data("group") as string] ?? DEFAULT_NODE_COLOR,
            label: "data(label)",
            "font-family": interFontFamily,
            "font-size": 10,
            color: "#edf2f2",
            "text-valign": "bottom",
            "text-margin-y": 6,
            // Halo (text-outline) : le libelle reste lisible quel que soit le
            // fond survole/la couleur du noeud - encodage textuel du type,
            // jamais la couleur seule (C2.2.3).
            "text-outline-color": LABEL_HALO_COLOR,
            "text-outline-width": 2,
            width: 24,
            height: 24,
            "border-width": 0,
          },
        },
        {
          // Survol / selection : Cytoscape n'a pas de pseudo-classe :hover,
          // classes basculees par les ecouteurs ci-dessous.
          selector: "node.is-hovered, node.is-selected",
          style: {
            "border-width": 2,
            "border-color": HOVER_COLOR,
            color: HOVER_COLOR,
          },
        },
        {
          selector: "node.is-selected",
          style: { "border-width": 3 },
        },
        {
          // Liaison (retour de recette) : AUCUNE ligne pendant le trace ni
          // apres le lacher. Retour visuel : l'etoile source et l'etoile cible
          // survolee sont mises en avant (contour epais), le curseur devient
          // une croix ; les deux restent marquees tant que la boite est ouverte.
          selector:
            "node.eh-source, node.eh-hover, node.eh-target, node.link-source, node.link-target",
          style: {
            "border-width": 4,
            "border-color": HOVER_COLOR,
            color: HOVER_COLOR,
          },
        },
        {
          // Une arete par paire (KAN-84). Fleche lue dans data(arrow) par une
          // fonction de style : aucun selecteur construit a partir d'une
          // donnee.
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#52525b",
            "line-opacity": 0.6,
            "target-arrow-color": "#52525b",
            "target-arrow-shape": (edge: EdgeSingular) =>
              edge.data("arrow") === true ? "triangle" : "none",
            "curve-style": "bezier",
          },
        },
        {
          // Reflet du texte : pointilles, sans libelle. La forme du trait (et
          // le libelle des aretes declarees) porte l'information, jamais la
          // couleur seule. Selecteurs STATIQUES.
          selector: 'edge[kind = "text"]',
          style: { "line-style": "dashed" },
        },
        {
          // Relation declaree : trait plein, libelle lu depuis la source de
          // l'arete. Libelle masque a zoom normal pour ne pas charger le ciel
          // (visible a partir de EDGE_LABEL_MIN_ZOOM), et toujours
          // visible au survol de l'arete ou d'une de ses etoiles.
          selector: 'edge[kind = "declared"]',
          style: {
            width: 1.5,
            "line-style": "solid",
            "line-opacity": 0.9,
            label: "data(label)",
            "font-family": interFontFamily,
            "font-size": 8,
            "text-opacity": 0,
            color: "#edf2f2",
            "text-outline-color": LABEL_HALO_COLOR,
            "text-outline-width": 2,
            "text-rotation": "autorotate",
          },
        },
        {
          selector: "edge.is-label-visible, edge.is-zoomed-in",
          style: { "text-opacity": 1 },
        },
        {
          // Poignee de liaison : petit disque contour, au-dessus de l'etoile.
          selector: "node.link-handle",
          style: {
            label: "",
            width: 12,
            height: 12,
            "background-color": LABEL_HALO_COLOR,
            "border-width": 2,
            "border-color": HOVER_COLOR,
          },
        },
        {
          selector: "node.link-handle.is-dragging",
          style: { opacity: 0 },
        },
        {
          // Trace d'une liaison (retour de recette) : UNE seule ligne, celle
          // tenue a la souris (arete fantome d'edgehandles vers le curseur).
          // L'arete de previsualisation source -> cible, qui apparait en plus
          // au survol de la cible, est masquee ; l'aimantation est coupee
          // (snap: false). Trait discontinu : jamais la couleur seule.
          selector: "edge.eh-ghost-edge",
          style: {
            width: 1.5,
            "line-style": "dashed",
            "line-dash-pattern": [6, 4],
            "line-color": HOVER_COLOR,
            "target-arrow-shape": "none",
            label: "",
          },
        },
        {
          selector: "edge.eh-preview",
          style: { display: "none" },
        },
        {
          selector: "node.eh-ghost-node",
          style: { opacity: 0, width: 1, height: 1, label: "" },
        },
      ],
    });
    cyRef.current = cy;

    // Cadrage enregistre restaure AVANT le placement : les nouvelles etoiles
    // sont ramenees dans la zone visible de ce cadrage. Sans cadrage (ou au
    // premier passage), ajustement a l'ecran puis un cran de recul, pour un
    // ciel aere. Le canvas reste invisible jusque-la : aucun saut visible.
    const restoreViewport = initial.initialViewport !== null && known.size > 0;
    if (restoreViewport && initial.initialViewport) {
      cy.viewport({
        zoom: initial.initialViewport.zoom,
        pan: { x: initial.initialViewport.panX, y: initial.initialViewport.panY },
      });
    }
    const placed = placeNewNodes(cy, known, initial.visibility);
    applyVisibility(cy, initial.visibility);
    if (!restoreViewport) {
      fitWithBreathingRoom(cy);
    }
    appliedElementsRef.current = initial.elements;
    container.classList.remove("invisible");
    if (placed.length > 0) {
      persistPositions(placed);
    }

    let ready = true;
    let positionsTimer: ReturnType<typeof setTimeout> | undefined;
    let viewportTimer: ReturnType<typeof setTimeout> | undefined;
    let handleHideTimer: ReturnType<typeof setTimeout> | undefined;
    let handleSource: NodeSingular | null = null;
    const pendingPositions = pendingPositionsRef.current;

    function flushPositions() {
      clearTimeout(positionsTimer);
      if (pendingPositions.size > 0) {
        persistPositions([...pendingPositions.values()]);
        pendingPositions.clear();
      }
    }

    // Lacher d'une etoile : sauvegarde regroupee.
    cy.on("dragfree", "node", (event) => {
      const node = event.target as NodeSingular;
      if (!isEntityNode(node)) {
        return;
      }
      pendingPositions.set(node.id(), {
        entityId: node.id(),
        x: node.position("x"),
        y: node.position("y"),
      });
      clearTimeout(positionsTimer);
      positionsTimer = setTimeout(flushPositions, POSITIONS_SAVE_DELAY_MS);
    });

    // Fin de mouvement du cadrage (molette, glisser le fond, boutons).
    syncZoomedLabels(cy);
    cy.on("zoom", () => syncZoomedLabels(cy));
    cy.on("viewport", () => {
      if (!ready) {
        return;
      }
      clearTimeout(viewportTimer);
      viewportTimer = setTimeout(() => {
        persistViewport({ zoom: cy.zoom(), panX: cy.pan().x, panY: cy.pan().y });
      }, VIEWPORT_SAVE_DELAY_MS);
    });

    // Selection (clic), ouverture de la fiche (double-clic).
    cy.on("tap", (event) => {
      if (event.target === cy) {
        selectNode(null);
      } else if (isEntityNode(event.target as SingularElementArgument)) {
        selectNode((event.target as NodeSingular).id());
      }
    });
    cy.on("dbltap", "node", (event) => {
      const node = event.target as NodeSingular;
      if (isEntityNode(node)) {
        openNode(node.id());
      }
    });

    // Liaison (edgehandles) : poignee au survol, ou Shift + glisser.
    const eh: EdgeHandlesInstance = cy.edgehandles({
      canConnect: (source, target) =>
        isEntityNode(source) && isEntityNode(target) && source.id() !== target.id(),
      edgeParams: (source, target) => ({
        data: { id: `link-ghost:${source.id()}:${target.id()}:${Date.now()}` },
        classes: "link-ghost",
      }),
      snap: false,
      hoverDelay: 150,
      noEdgeEventsInDraw: true,
      disableBrowserGestures: true,
    });

    function removeHandle() {
      clearTimeout(handleHideTimer);
      cy.getElementById(LINK_HANDLE_ID).remove();
      handleSource = null;
    }
    function scheduleHandleRemoval() {
      clearTimeout(handleHideTimer);
      handleHideTimer = setTimeout(removeHandle, HANDLE_HIDE_DELAY_MS);
    }
    function showHandle(node: NodeSingular) {
      clearTimeout(handleHideTimer);
      handleSource = node;
      const position = {
        x: node.position("x"),
        y: node.position("y") + LINK_HANDLE_OFFSET_Y,
      };
      const existing = cy.getElementById(LINK_HANDLE_ID);
      if (existing.nonempty()) {
        existing.position(position);
        return;
      }
      cy.add({
        group: "nodes",
        data: { id: LINK_HANDLE_ID },
        position,
        classes: "link-handle",
        grabbable: false,
        selectable: false,
      });
    }

    cy.on("mouseover", "node", (event) => {
      const node = event.target as NodeSingular;
      if (node.id() === LINK_HANDLE_ID) {
        clearTimeout(handleHideTimer);
        return;
      }
      if (!isEntityNode(node)) {
        return;
      }
      node.addClass("is-hovered");
      node.connectedEdges().addClass("is-label-visible");
      if (!node.grabbed()) {
        showHandle(node);
      }
    });
    cy.on("mouseout", "node", (event) => {
      const node = event.target as NodeSingular;
      if (node.id() === LINK_HANDLE_ID) {
        scheduleHandleRemoval();
        return;
      }
      if (!isEntityNode(node)) {
        return;
      }
      node.removeClass("is-hovered");
      node.connectedEdges().removeClass("is-label-visible");
      scheduleHandleRemoval();
    });
    cy.on("grab", "node", () => removeHandle());
    // Relachee (clic ou deplacement) sous le pointeur : la poignee revient.
    cy.on("free", "node", (event) => {
      const node = event.target as NodeSingular;
      if (isEntityNode(node) && node.hasClass("is-hovered")) {
        showHandle(node);
      }
    });
    cy.on("mouseover", "edge", (event) => {
      if (isWorldEdge(event.target as SingularElementArgument)) {
        (event.target as EdgeSingular).addClass("is-label-visible");
      }
    });
    cy.on("mouseout", "edge", (event) => {
      if (isWorldEdge(event.target as SingularElementArgument)) {
        (event.target as EdgeSingular).removeClass("is-label-visible");
      }
    });
    cy.on("tapstart", "node", (event) => {
      const node = event.target as NodeSingular;
      if (node.id() === LINK_HANDLE_ID && handleSource) {
        clearTimeout(handleHideTimer);
        node.addClass("is-dragging");
        eh.start(handleSource);
      }
    });
    cy.on("ehstart", () => {
      container.style.cursor = "crosshair";
    });
    cy.on("ehstop", () => {
      removeHandle();
      container.style.cursor = drawMode ? "crosshair" : "";
    });
    // Lacher sur une autre etoile : l'arete ajoutee par edgehandles est
    // retiree aussitot (aucune arete fantome) ; source et cible restent mises
    // en avant jusqu'a la fermeture de la boite (clearLinkHighlight).
    cy.on("ehcomplete", (_event, ...extra: unknown[]) => {
      const [source, target, addedEdge] = extra as [NodeSingular, NodeSingular, EdgeSingular];
      addedEdge.remove();
      for (const node of linkEndsRef.current) {
        node.removeClass("link-source link-target");
      }
      source.addClass("link-source");
      target.addClass("link-target");
      linkEndsRef.current = [source, target];
      requestLink(source.id(), target.id());
    });

    // Shift + glisser depuis une etoile : meme trace que la poignee. Sans
    // Shift, glisser une etoile la deplace (comportement inchange).
    let drawMode = false;
    const setDrawMode = (enabled: boolean) => {
      if (enabled === drawMode) {
        return;
      }
      drawMode = enabled;
      container.style.cursor = enabled ? "crosshair" : "";
      if (enabled) {
        eh.enableDrawMode();
      } else {
        eh.disableDrawMode();
      }
    };
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Shift") {
        setDrawMode(true);
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "Shift") {
        setDrawMode(false);
      }
    }
    function onWindowBlur() {
      setDrawMode(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    if (process.env.NEXT_PUBLIC_E2E_HOOKS === "1") {
      window.__storyTideConstellation = {
        nodes: () => {
          const rect = container.getBoundingClientRect();
          return entityNodes(cy).map((node) => ({
            id: node.id(),
            label: node.data("label") as string,
            x: node.position("x"),
            y: node.position("y"),
            clientX: rect.left + node.renderedPosition().x,
            clientY: rect.top + node.renderedPosition().y,
          }));
        },
      };
    }

    return () => {
      ready = false;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      // Positions lachees juste avant de quitter la page : envoyees tout de
      // suite plutot que perdues avec le minuteur.
      flushPositions();
      clearTimeout(viewportTimer);
      clearTimeout(handleHideTimer);
      if (process.env.NEXT_PUBLIC_E2E_HOOKS === "1") {
        delete window.__storyTideConstellation;
      }
      eh.destroy();
      linkEndsRef.current = [];
      appliedElementsRef.current = null;
      cyRef.current = null;
      cy.destroy();
    };
  }, []);

  // Mise a jour par difference (KAN-87) : jamais de recreation de l'instance.
  useEffect(() => {
    const cy = cyRef.current;
    const applied = appliedElementsRef.current;
    if (!cy || !applied || applied === elements) {
      return;
    }
    const diff = diffGraphElements(applied, elements);
    appliedElementsRef.current = elements;
    if (isEmptyDiff(diff)) {
      return;
    }
    cy.batch(() => {
      for (const id of [...diff.removeEdgeIds, ...diff.removeNodeIds]) {
        cy.getElementById(id).remove();
      }
      for (const element of [...diff.updateNodes, ...diff.updateEdges]) {
        cy.getElementById(element.data.id).data(element.data);
      }
      cy.add([
        ...diff.addNodes.map((node) => ({ group: "nodes" as const, data: node.data })),
        ...diff.addEdges.map((edge) => ({ group: "edges" as const, data: edge.data })),
      ]);
    });
    const added = new Set(diff.addNodes.map((node) => node.data.id));
    const known = new Map<string, NodePosition>();
    entityNodes(cy).forEach((node) => {
      if (!added.has(node.id())) {
        known.set(node.id(), { x: node.position("x"), y: node.position("y") });
      }
    });
    const placed = placeNewNodes(cy, known, readVisibility());
    applyVisibility(cy, readVisibility());
    syncZoomedLabels(cy);
    if (placed.length > 0) {
      persistPositions(placed);
    }
  }, [elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (cy) {
      applyVisibility(cy, visibility);
    }
  }, [visibility]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.batch(() => {
      entityNodes(cy).forEach((node) => {
        if (node.id() === selectedNodeId) {
          node.addClass("is-selected");
        } else {
          node.removeClass("is-selected");
        }
      });
    });
  }, [selectedNodeId, elements]);

  // Ancre de la carte de selection : suit l'etoile pendant un deplacement,
  // un zoom ou un panoramique (une mesure par frame au plus).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !selectedNodeId) {
      reportAnchor(null);
      return;
    }
    const node = cy.getElementById(selectedNodeId);
    if (node.empty()) {
      reportAnchor(null);
      return;
    }
    let frame = 0;
    function measure() {
      frame = 0;
      if (!cy) {
        return;
      }
      const box = node.renderedBoundingBox({ includeLabels: false });
      const obstacles: ScreenBox[] = [];
      cy.nodes().forEach((other) => {
        if (isEntityNode(other) && other.id() !== node.id() && other.visible()) {
          const bounds = other.renderedBoundingBox({ includeLabels: true });
          obstacles.push({ x1: bounds.x1, y1: bounds.y1, x2: bounds.x2, y2: bounds.y2 });
        }
      });
      cy.edges().forEach((edge) => {
        if (isWorldEdge(edge) && edge.visible()) {
          const middle = edge.renderedMidpoint();
          const half = EDGE_OBSTACLE_SIZE / 2;
          obstacles.push({
            x1: middle.x - half,
            y1: middle.y - half,
            x2: middle.x + half,
            y2: middle.y + half,
          });
        }
      });
      reportAnchor({ box: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 }, obstacles });
    }
    function schedule() {
      if (frame === 0) {
        frame = requestAnimationFrame(measure);
      }
    }
    measure();
    node.on("position", schedule);
    cy.on("viewport resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      node.off("position", undefined, schedule);
      cy.off("viewport resize", schedule);
    };
  }, [selectedNodeId, elements]);

  useImperativeHandle(ref, () => {
    function zoomBy(factor: number) {
      const cy = cyRef.current;
      if (!cy) {
        return;
      }
      cy.zoom({
        level: clampZoom(cy.zoom() * factor),
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
    }
    return {
      zoomIn: () => zoomBy(ZOOM_STEP),
      zoomOut: () => zoomBy(1 / ZOOM_STEP),
      fit: () => {
        const cy = cyRef.current;
        if (cy) {
          fitWithBreathingRoom(cy, true);
        }
      },
      getPositions: () => (cyRef.current ? currentPositions(cyRef.current) : []),
      applyPositions: (positions) => {
        const cy = cyRef.current;
        if (!cy) {
          return;
        }
        pendingPositionsRef.current.clear();
        cy.batch(() => {
          for (const { entityId, x, y } of positions) {
            cy.getElementById(entityId).position({ x, y });
          }
        });
      },
      reorganize: () => {
        const cy = cyRef.current;
        if (!cy) {
          return [];
        }
        pendingPositionsRef.current.clear();
        placeNewNodes(cy, new Map(), visibility);
        fitWithBreathingRoom(cy);
        return currentPositions(cy);
      },
      clearLinkHighlight: () => {
        for (const node of linkEndsRef.current) {
          node.removeClass("link-source link-target");
        }
        linkEndsRef.current = [];
      },
    };
  }, [visibility]);

  // Fond navy uni (--background) ; la trame celeste viendra au lot C2.
  // `invisible` jusqu'a ce que les positions soient posees (aucun saut).
  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="graph-canvas"
      className={cn("invisible relative overflow-hidden bg-background", className)}
    />
  );
}
