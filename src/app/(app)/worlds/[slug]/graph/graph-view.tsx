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
import { pairEdgeId, type GraphElements } from "@/lib/graph-elements";
import type { GraphVisibility } from "@/lib/graph-filters";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampIntoView,
  separateFromStars,
  fcoseOptions,
  fitViewport,
  largestFreeRect,
  type ReservedCorners,
  planPlacement,
  type NodePosition,
} from "@/lib/graph-layout";
import { arrangeSky, skyCommunities } from "@/lib/sky-arrange";
import { edgeLabelsFollowZoom, isNameVisible, relativeZoom } from "@/lib/sky-detail";
import { buildSkyStylesheet } from "@/lib/sky-stylesheet";
import { isBrightnessTier, type BrightnessTier } from "@/lib/star-brightness";
import { DEFAULT_SKY_PALETTE, readSkyPalette, type SkyPalette } from "@/lib/sky-theme";
import { cn } from "@/lib/utils";
import {
  createConstellationLight,
  NO_ARRIVAL,
  playArrival,
  prefersReducedMotion,
  traceNewRelation,
  type ArrivalHandle,
} from "./sky-animations";

// Poignee de liaison (KAN-87) : un noeud technique pose au-dessus de l'etoile
// survolee (edgehandles v4 n'en fournit plus). Ce n'est jamais une entree :
// exclu du diff, des positions, des filtres et des sauvegardes.
const LINK_HANDLE_ID = "__link-handle";
const LINK_HANDLE_OFFSET_Y = -22;
const HANDLE_HIDE_DELAY_MS = 250;
const POSITIONS_SAVE_DELAY_MS = 400;
const VIEWPORT_SAVE_DELAY_MS = 800;
const ZOOM_STEP = 1.25;
// Plafond du zoom apres « ajuster » (retour de recette) : un petit monde ne
// s'affiche jamais en gros plan.
const FIT_MAX_ZOOM = 1.2;
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
// Trace a la creation d'une relation (KAN-85) : attente maximale de l'arete
// apres la fermeture de la boite (le rafraichissement serveur l'apporte).
const TRACE_WAIT_MS = 5000;

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
function worldEdges(cy: Core) {
  return cy.edges().filter((edge) => isWorldEdge(edge));
}

// Etoiles et lignes du monde (sans poignee ni fantomes d'edgehandles).
function worldCollection(cy: Core) {
  return cy.elements().filter((element) => isEntityNode(element) || isWorldEdge(element));
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

// Coins de la scene occupes par l'interface posee sur le ciel (titre,
// pilules, controles, compteurs, sidebar en verre) : mesures par la
// Constellation (prop getReservedCorners), enregistres sur l'instance au
// montage et lus a chaque cadrage.
function reservedCorners(cy: Core): ReservedCorners {
  const read: unknown = cy.scratch("_skyCorners");
  if (typeof read !== "function") {
    return {};
  }
  const corners: unknown = read();
  return typeof corners === "object" && corners !== null ? corners : {};
}

// Cadrage « ajuster a l'ecran » (KAN-85) : les etoiles occupent ~85 % du plus
// favorable des rectangles libres de la scene (seuls les coins occupes sont
// reserves, fitViewport), sans depasser FIT_MAX_ZOOM.
function computeFitView(cy: Core, { visibleOnly = false, includeLabels = true } = {}) {
  const nodes = entityCollection(cy, visibleOnly);
  if (nodes.empty()) {
    return null;
  }
  const box = nodes.boundingBox({ includeLabels });
  return fitViewport({
    bounds: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 },
    width: cy.width(),
    height: cy.height(),
    corners: reservedCorners(cy),
    minZoom: MIN_ZOOM,
    maxZoom: FIT_MAX_ZOOM,
  });
}

function fitWithBreathingRoom(cy: Core, visibleOnly = false) {
  const view = computeFitView(cy, { visibleOnly });
  if (view) {
    cy.viewport({ zoom: view.zoom, pan: view.pan });
  }
}

const ALL_TIERS: BrightnessTier[] = [0, 1, 2, 3];

// Zoom de reference du niveau de detail (KAN-85) : le zoom « ajuster » de
// TOUT le monde, sans les libelles (sinon il dependrait des noms affiches).
// Recalcule quand la disposition ou la taille du canvas change.
function updateFitReference(cy: Core) {
  cy.scratch("_skyFitZoom", computeFitView(cy, { includeLabels: false })?.zoom ?? cy.zoom());
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

// Niveau de detail selon le zoom (KAN-85, sky-detail.ts), applique par
// classes en lot :
// - is-named sur les etoiles dont le palier est nomme au zoom relatif courant
//   (toutes dans un petit monde) ;
// - is-zoomed-in sur les aretes au-dela du seuil de C1, seulement si le monde
//   a peu de lignes visibles (sinon survol et selection uniquement).
// Pendant un zoom, rien n'est reparcouru tant que l'etat ne change pas ;
// `force` (diff, filtres, nouvelle reference) reapplique tout.
function syncZoomedLabels(cy: Core, force = false) {
  const stars = entityCollection(cy, true);
  const visibleEdges = worldEdges(cy).filter((edge) => edge.visible()).length;
  const rel = relativeZoom(cy.zoom(), Number(cy.scratch("_skyFitZoom")));
  const edgesZoomed = edgeLabelsFollowZoom(visibleEdges) && cy.zoom() >= EDGE_LABEL_MIN_ZOOM;
  const namedTiers = ALL_TIERS.filter((tier) => isNameVisible(tier, rel, stars.length));
  const state = `${edgesZoomed}:${namedTiers.join("")}`;
  if (!force && cy.scratch("_skyZoomState") === state) {
    return;
  }
  cy.scratch("_skyZoomState", state);
  cy.batch(() => {
    cy.edges().forEach((edge) => {
      if (isWorldEdge(edge)) {
        edge.toggleClass("is-zoomed-in", edgesZoomed);
      }
    });
    cy.nodes().forEach((node) => {
      if (isEntityNode(node)) {
        const tier: unknown = node.data("tier");
        node.toggleClass("is-named", namedTiers.includes(isBrightnessTier(tier) ? tier : 0));
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

// « Ponts » : lignes entre deux constellations, plus discretes que les
// lignes internes (sky-stylesheet.ts, jeton --sky-line-bridge-opacity).
// Recalcule a chaque changement des elements, quelle que soit la
// disposition (une disposition memorisee garde ses ponts lisibles).
function syncBridges(cy: Core) {
  const communities = skyCommunities(cy);
  cy.batch(() => {
    worldEdges(cy)
      .edges()
      .forEach((edge) => {
        edge.toggleClass(
          "is-bridge",
          communities.get(edge.source().id()) !== communities.get(edge.target().id()),
        );
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
  if (plan.mode === "full") {
    // Proportions du plus grand rectangle libre de la scene.
    const free = largestFreeRect(cy.width(), cy.height(), reservedCorners(cy));
    arrangeSky(cy, (free.x2 - free.x1) / Math.max(free.y2 - free.y1, 1));
  } else {
    const worldElements = cy
      .elements()
      .filter((element) => isEntityNode(element) || isWorldEdge(element));
    worldElements.layout(fcoseOptions(plan, nodes.length)).run();
  }
  if (plan.mode === "incremental") {
    // Dans le champ, et jamais sur une autre etoile (BUG-019) : chaque
    // nouvelle etoile evite toutes les autres, y compris celles placees juste
    // avant elle.
    const extent = cy.extent();
    for (const nodeId of plan.newNodeIds) {
      const node = cy.getElementById(nodeId);
      const others = nodes
        .filter((other) => other.id() !== nodeId)
        .map((other) => ({ x: other.position("x"), y: other.position("y") }));
      node.position(separateFromStars(clampIntoView(node.position(), extent), others, extent));
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
  // Relation creee depuis le graphe (KAN-85) : la ligne se trace de `fromId`
  // vers `toId` des que l'arete declaree est la (tout de suite, ou a l'arrivee
  // des elements rafraichis).
  traceRelation: (fromId: string, toId: string) => void;
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
    // Ciel (KAN-85) : opacite effective (transitions comprises) et
    // attenuation au survol.
    opacity: number;
    dimmed: boolean;
    // Niveau de detail (KAN-85) : nom affiche.
    named: boolean;
  }[];
  // Arrivee animee en cours ou terminee.
  arrival: () => "running" | "done";
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
  getReservedCorners,
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
  // Coins de la scene occupes par l'interface (pixels du conteneur).
  getReservedCorners?: () => ReservedCorners;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const linkEndsRef = useRef<NodeSingular[]>([]);
  // Derniers elements appliques a l'instance : base du diff.
  const appliedElementsRef = useRef<GraphElements | null>(null);
  const pendingPositionsRef = useRef(new Map<string, BoardPosition>());
  // Ciel (KAN-85) : palette lue au montage, trace en attente de son arete.
  const paletteRef = useRef<SkyPalette>(DEFAULT_SKY_PALETTE);
  const pendingTraceRef = useRef<{ edgeId: string; fromId: string; expiresAt: number } | null>(
    null,
  );

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
  const readCorners = useEffectEvent(() => getReservedCorners?.() ?? {});
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

    // Jetons du ciel lus sur le conteneur (principe 7 : une surcharge par
    // monde n'aura qu'a poser les variables plus haut) ; icones du type lues
    // dans le sprite cache rendu par ce composant.
    const palette = readSkyPalette(container);
    paletteRef.current = palette;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const buildStyle = () =>
      buildSkyStylesheet({
        palette,
        fontFamily: interFontFamily,
        reducedMotion: motionQuery.matches,
      });

    // Le ciel s'allume a l'arrivee (KAN-85) : une seule fois par montage -
    // l'instance n'est jamais recreee, ni router.refresh ni le diff ne la
    // rejouent. Jamais si l'onglet est cache ou en reduced-motion. Etoiles et
    // lignes sont CREEES eteintes (aucune transition de depart).
    const animateArrival = document.visibilityState === "visible" && !motionQuery.matches;
    const unlit = animateArrival ? "is-unlit" : undefined;
    const definitions: ElementDefinition[] = [
      ...initial.elements.nodes.map((node) => {
        const position = known.get(node.data.id);
        return position
          ? { data: node.data, position: { ...position }, classes: unlit }
          : { data: node.data, classes: unlit };
      }),
      ...initial.elements.edges.map((edge) => ({ data: edge.data, classes: unlit })),
    ];

    const cy = cytoscape({
      container,
      elements: definitions,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // Positions posees telles quelles (preset) ; les nouvelles sont
      // placees juste apres par placeNewNodes.
      layout: { name: "preset", fit: false },
      // Ciel d'histoires (KAN-85) : palette lue sur les jetons CSS une fois
      // au montage (sky-theme.ts), aucune couleur en dur ici.
      style: buildStyle(),
    });
    cyRef.current = cy;
    cy.scratch("_skyCorners", () => readCorners());

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
    const arrival: ArrivalHandle = animateArrival
      ? playArrival(cy, entityCollection(cy), worldEdges(cy))
      : NO_ARRIVAL;
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
    syncBridges(cy);
    updateFitReference(cy);
    syncZoomedLabels(cy, true);
    cy.on("zoom", () => syncZoomedLabels(cy));
    cy.on("resize", () => {
      updateFitReference(cy);
      syncZoomedLabels(cy, true);
    });

    // L'arrivee ne bloque rien : le premier geste sur le canvas (clic,
    // glisser) la termine aussitot - l'etoile visee est pleinement visible.
    // Zoom et deplacement de la vue la laissent se jouer.
    cy.on("tapstart grab", () => arrival.finish());
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        arrival.finish();
      }
    }
    // Reduced-motion active pendant la visite : etat final, transitions a 0.
    function onMotionChange() {
      if (motionQuery.matches) {
        arrival.finish();
      }
      cy.style(buildStyle());
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);
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

    // Liaison en cours (edgehandles) ou glisser d'une etoile : pas
    // d'eclairage au survol (le pointeur croise d'autres etoiles pendant le
    // geste - les eclairer relancerait des transitions a chaque croisement).
    let linking = false;
    let dragging = false;
    const constellationLight = createConstellationLight(cy, () => worldCollection(cy));

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
      // Eclairage de sa constellation (KAN-85), sauf pendant une liaison
      // (trace en cours ou boite ouverte) ou le glisser d'une etoile.
      if (!linking && !dragging && linkEndsRef.current.length === 0) {
        constellationLight.light(node);
      }
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
      constellationLight.scheduleClear();
      scheduleHandleRemoval();
    });
    cy.on("grab", "node", () => {
      dragging = true;
      removeHandle();
      constellationLight.clear();
    });
    // Relachee (clic ou deplacement) sous le pointeur : la poignee revient.
    cy.on("free", "node", (event) => {
      dragging = false;
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
      linking = true;
      constellationLight.clear();
      container.style.cursor = "crosshair";
    });
    cy.on("ehstop", () => {
      linking = false;
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
            // Opacite VISIBLE : celle de l'element (attenuation au survol)
            // fois celle de son image (coeur et lueur, KAN-85 : 0 tant que
            // l'arrivee ne l'a pas allumee ; le disque de fond reste a 0).
            opacity: node.numericStyle("opacity") * node.numericStyle("background-image-opacity"),
            dimmed: node.hasClass("is-dimmed"),
            named: String(node.style("label")) !== "",
          }));
        },
        arrival: () => (arrival.running() ? "running" : "done"),
      };
    }

    return () => {
      ready = false;
      arrival.finish();
      constellationLight.clear();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
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
    syncBridges(cy);
    updateFitReference(cy);
    syncZoomedLabels(cy, true);
    if (placed.length > 0) {
      persistPositions(placed);
    }
    // Relation creee depuis le graphe : sa ligne arrive avec ces elements.
    const pending = pendingTraceRef.current;
    if (pending) {
      const changed = [...diff.addEdges, ...diff.updateEdges].some(
        (edge) => edge.data.id === pending.edgeId,
      );
      if (changed || Date.now() > pending.expiresAt) {
        pendingTraceRef.current = null;
      }
      const edge = cy.getElementById(pending.edgeId);
      if (changed && edge.nonempty() && edge.isEdge() && edge.data("kind") === "declared") {
        traceNewRelation(edge, pending.fromId, paletteRef.current);
      }
    }
  }, [elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (cy) {
      applyVisibility(cy, visibility);
      syncZoomedLabels(cy, true);
    }
  }, [visibility]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.batch(() => {
      entityNodes(cy).forEach((node) => {
        // Libelles des relations de l'etoile selectionnee (KAN-85) : classe
        // propre, jamais retiree par la sortie du survol.
        const selected = node.id() === selectedNodeId;
        node.toggleClass("is-selected", selected);
        node.connectedEdges().toggleClass("is-selected-edge", selected);
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
        updateFitReference(cy);
        syncZoomedLabels(cy, true);
      },
      reorganize: () => {
        const cy = cyRef.current;
        if (!cy) {
          return [];
        }
        pendingPositionsRef.current.clear();
        placeNewNodes(cy, new Map(), visibility);
        updateFitReference(cy);
        fitWithBreathingRoom(cy);
        syncZoomedLabels(cy, true);
        return currentPositions(cy);
      },
      clearLinkHighlight: () => {
        for (const node of linkEndsRef.current) {
          node.removeClass("link-source link-target");
        }
        linkEndsRef.current = [];
      },
      traceRelation: (fromId, toId) => {
        const cy = cyRef.current;
        if (!cy || prefersReducedMotion()) {
          return;
        }
        const edgeId = pairEdgeId(fromId, toId);
        const edge = cy.getElementById(edgeId);
        // Elements deja rafraichis avant la fermeture de la boite : l'arete
        // declaree est la, on trace tout de suite ; sinon, a son arrivee.
        if (edge.nonempty() && edge.isEdge() && edge.data("kind") === "declared") {
          traceNewRelation(edge, fromId, paletteRef.current);
          return;
        }
        pendingTraceRef.current = { edgeId, fromId, expiresAt: Date.now() + TRACE_WAIT_MS };
      },
    };
  }, [visibility]);

  // Canvas transparent : le ciel (fond, trame, etoiles lointaines) est peint
  // dessous en pseudo-elements (.sky-chart / .sky-far-stars, globals.css).
  // `invisible` jusqu'a ce que les positions soient posees (aucun saut).
  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="graph-canvas"
      className={cn("invisible relative overflow-hidden", className)}
    />
  );
}
