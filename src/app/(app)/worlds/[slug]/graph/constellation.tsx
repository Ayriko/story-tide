"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkle, X } from "lucide-react";
import { replaceLayoutAction } from "@/actions/board";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BoardPosition, BoardViewport } from "@/lib/board-schemas";
import { ENTITY_TYPE_GROUPS } from "@/lib/entity-schemas";
import { chooseCardPlacement } from "@/lib/graph-card-placement";
import { pairEdgeId, type AccessibleGraphEntry, type GraphElements } from "@/lib/graph-elements";
import {
  computeVisibility,
  depthLabel,
  entryTypeFilterGroups,
  graphFiltersStorageKey,
  hasActiveFilters,
  parseStoredFilters,
  relationFilterOptions,
  type FocusDepth,
  type GraphFilters,
  type GraphFocus,
} from "@/lib/graph-filters";
import type { WorldRelationTypeCatalog } from "@/lib/relation-types";
import { cn } from "@/lib/utils";
import { CreateEntityDialog } from "../create-entity-dialog";
import { ConstellationToasts, useConstellationToasts } from "./constellation-toasts";
import { GraphAccessibleList } from "./graph-accessible-list";
import { GraphControls } from "./graph-controls";
import { GraphFiltersPanel } from "./graph-filters-panel";
import { GraphSelectionCard } from "./graph-selection-card";
import { GraphView, type GraphViewHandle, type SelectionAnchor } from "./graph-view";
import { RelationFromGraphDialog, type LinkEndpoint } from "./relation-from-graph-dialog";
import { useStoredString } from "./use-stored-string";

// Taille estimee de la carte de selection avant sa premiere mesure ; la
// barre haute flotte sur les 4 premiers rem du canvas.
const SELECTION_CARD_ESTIMATE = { width: 240, height: 112 };
const TOP_BAR_OFFSET = 64;

// Outils de la rangee haut droite : un seul panneau ouvert a la fois.
const TOOLS = [
  { id: "filters", label: "Filtres" },
  { id: "recent", label: "Récents" },
  { id: "threads", label: "Fils" },
] as const;
type ToolId = (typeof TOOLS)[number]["id"];

const GLASS_SURFACE =
  "border border-glass-border bg-glass-surface shadow-lg backdrop-blur-(--glass-blur)";

export type ConstellationEntity = { id: string; name: string; typeLabel: string };

// Raccourcis de la zone du graphe, SANS modificateur (retour de recette :
// Ctrl++ / Ctrl+- / Ctrl+0 restent toujours au zoom du navigateur). Actifs
// seulement quand la zone du graphe elle-meme a le focus.
function shortcutOf(event: React.KeyboardEvent): "fit" | "zoomIn" | "zoomOut" | "create" | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (event.key === "n" || event.key === "N") {
    return "create";
  }
  if (event.key === "0" || event.code === "Numpad0") {
    return "fit";
  }
  if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
    return "zoomIn";
  }
  if (event.key === "-" || event.code === "NumpadSubtract") {
    return "zoomOut";
  }
  return null;
}

// La page d'un monde (KAN-87, ADR-0032) : la Constellation sur toute la
// hauteur de l'ecran. Titre du monde pose sur le canvas (haut gauche, recu en
// `title`, rendu serveur), rangee d'outils (haut droite : Filtres, Recents,
// Fils), « + Nouvelle entree » et controles de vue (bas droite), liaison par
// geste, carte de selection. Filtres memorises dans le navigateur.
export function Constellation({
  worldId,
  worldSlug,
  elements,
  entities,
  accessibleEntries,
  initialViewport,
  initialPositions,
  relationCatalog,
  title,
  recent,
}: {
  worldId: string;
  worldSlug: string;
  elements: GraphElements;
  entities: ConstellationEntity[];
  accessibleEntries: AccessibleGraphEntry[];
  initialViewport: BoardViewport | null;
  initialPositions: BoardPosition[];
  relationCatalog: WorldRelationTypeCatalog;
  title: ReactNode;
  recent: ReactNode;
}) {
  const router = useRouter();
  const graphRef = useRef<GraphViewHandle>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toasts, show, dismiss } = useConstellationToasts();

  const [filtersRaw, setFiltersRaw] = useStoredString(graphFiltersStorageKey(worldId));
  const filters = useMemo(() => parseStoredFilters(filtersRaw), [filtersRaw]);
  const setFilters = (next: GraphFilters) => setFiltersRaw(JSON.stringify(next));

  const [openTool, setOpenTool] = useState<ToolId | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardPosition, setCardPosition] = useState<{ left: number; top: number } | null>(null);
  const [pendingLink, setPendingLink] = useState<{ aId: string; bId: string } | null>(null);

  const entityById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );
  const nodeById = useMemo(
    () => new Map(elements.nodes.map((node) => [node.data.id, node.data])),
    [elements],
  );
  const visibility = useMemo(() => computeVisibility(elements, filters), [elements, filters]);
  const filtersActive = hasActiveFilters(filters);

  // Types filtrables : seulement ceux qui ont au moins une entree, avec
  // leur nombre (un type masque encore utilise reste donc filtrable, KAN-81).
  const filterGroups = useMemo(
    () =>
      entryTypeFilterGroups(
        elements.nodes.map(({ data }) => ({
          typeKey: data.typeKey,
          group: data.group,
          typeLabel: entityById.get(data.id)?.typeLabel ?? data.typeKey,
        })),
        ENTITY_TYPE_GROUPS,
      ),
    [elements, entityById],
  );
  const relationOptions = useMemo(() => relationFilterOptions(elements), [elements]);

  // Liste accessible : memes filtres que le canvas (entree visible, cible
  // visible, arete de la paire visible).
  const visibleEntries = useMemo(() => {
    if (!filtersActive) {
      return accessibleEntries;
    }
    return accessibleEntries.flatMap((entry) => {
      if (!visibility.nodeIds.has(entry.id)) {
        return [];
      }
      const outgoing = entry.outgoing.filter(
        (target) =>
          visibility.nodeIds.has(target.id) &&
          visibility.edgeIds.has(pairEdgeId(entry.id, target.id)),
      );
      return outgoing.length > 0 ? [{ ...entry, outgoing }] : [];
    });
  }, [accessibleEntries, filtersActive, visibility]);

  const focus = filters.focus;
  const focusEntity = focus ? entityById.get(focus.entityId) : undefined;
  const selectedEntity =
    selectedId && visibility.nodeIds.has(selectedId) ? entityById.get(selectedId) : undefined;

  function applyFocus(entityId: string, mode: GraphFocus["mode"], depth: FocusDepth) {
    setFilters({ ...filters, focus: { mode, entityId, depth } });
  }

  function endpoint(id: string): LinkEndpoint | null {
    const node = nodeById.get(id);
    return node ? { id, name: node.label, key: node.typeKey, group: node.group } : null;
  }

  function closeLink() {
    graphRef.current?.clearLinkHighlight();
    setPendingLink(null);
  }

  // Carte a cote de l'etoile, du cote qui masque le moins de voisins ; elle
  // disparait tant que l'etoile est hors champ.
  function onSelectionAnchor(anchor: SelectionAnchor | null) {
    const zone = zoneRef.current;
    if (!anchor || !zone) {
      setCardPosition(null);
      return;
    }
    const width = zone.clientWidth;
    const height = zone.clientHeight;
    const { box } = anchor;
    if (box.x2 < 0 || box.x1 > width || box.y2 < 0 || box.y1 > height) {
      setCardPosition(null);
      return;
    }
    const card = cardRef.current
      ? { width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight }
      : SELECTION_CARD_ESTIMATE;
    const { left, top } = chooseCardPlacement({
      anchor: box,
      card,
      container: { width, height },
      obstacles: anchor.obstacles,
      topInset: TOP_BAR_OFFSET,
    });
    setCardPosition({ left, top });
  }

  function reorganize() {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    const previous = graph.getPositions();
    const next = graph.reorganize();
    replaceLayoutAction(worldSlug, next)
      .then((result) => {
        if (!result.ok) {
          show({ message: result.error });
          return;
        }
        show({
          message: "Disposition réorganisée",
          action: {
            label: "Annuler",
            onAction: () => {
              graphRef.current?.applyPositions(previous);
              replaceLayoutAction(worldSlug, previous)
                .then((undo) => {
                  if (!undo.ok) {
                    show({ message: undo.error });
                  }
                })
                .catch((error: unknown) => {
                  console.error(
                    "[constellation] Annulation de la réorganisation injoignable :",
                    error,
                  );
                  show({ message: "Sauvegarde de la disposition impossible pour le moment." });
                });
            },
          },
        });
      })
      .catch((error: unknown) => {
        console.error("[constellation] Réorganisation injoignable :", error);
        show({ message: "Sauvegarde de la disposition impossible pour le moment." });
      });
  }

  function onZoneKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === "Escape") {
      setSelectedId(null);
      setOpenTool(null);
      return;
    }
    const shortcut = shortcutOf(event);
    if (!shortcut) {
      return;
    }
    event.preventDefault();
    if (shortcut === "create") {
      setCreateOpen(true);
    } else if (shortcut === "fit") {
      graphRef.current?.fit();
    } else if (shortcut === "zoomIn") {
      graphRef.current?.zoomIn();
    } else {
      graphRef.current?.zoomOut();
    }
  }

  function toolContent(tool: ToolId): ReactNode {
    if (tool === "filters") {
      return (
        <GraphFiltersPanel
          filterGroups={filterGroups}
          relationOptions={relationOptions}
          filters={filters}
          focusEntityName={focusEntity?.name ?? null}
          onChange={setFilters}
        />
      );
    }
    if (tool === "recent") {
      return recent;
    }
    return (
      <div className="flex flex-col gap-2">
        {filtersActive ? (
          <p className="text-xs text-foreground">
            Filtres actifs : la liste n&apos;affiche que les entrées visibles.
          </p>
        ) : null}
        <GraphAccessibleList worldSlug={worldSlug} entries={visibleEntries} />
      </div>
    );
  }

  const linkA = pendingLink ? endpoint(pendingLink.aId) : null;
  const linkB = pendingLink ? endpoint(pendingLink.bId) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Zone du graphe focusable : porte les raccourcis clavier. Le canvas
          lui-meme reste aria-hidden (affordance souris, ADR-0012) ; le chemin
          accessible est la liste du panneau « Fils ». */}
      <div
        ref={zoneRef}
        tabIndex={0}
        role="group"
        aria-label="Constellation. Touches + et - : zoom, 0 : ajuster à l'écran, N : nouvelle entrée."
        onKeyDown={onZoneKeyDown}
        // Cytoscape retire le focus du document a chaque mousedown sur son
        // canvas (constate : focusout vers <body>) : la zone le reprend au
        // relachement, pour que + / - / 0 agissent apres un clic dans le graphe.
        onPointerUpCapture={() => zoneRef.current?.focus({ preventScroll: true })}
        className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <GraphView
          ref={graphRef}
          worldSlug={worldSlug}
          elements={elements}
          initialViewport={initialViewport}
          initialPositions={initialPositions}
          visibility={visibility}
          selectedNodeId={selectedEntity ? selectedEntity.id : null}
          onSelectNode={setSelectedId}
          onOpenNode={(nodeId) => router.push(`/worlds/${worldSlug}/entities/${nodeId}`)}
          onLinkRequest={(aId, bId) => setPendingLink({ aId, bId })}
          onSaveError={(message) => show({ message })}
          onSelectionAnchor={onSelectionAnchor}
          className="h-full w-full"
        />
      </div>

      {/* Titre du monde et compteurs (haut gauche), poses sur le canvas, sous
          la barre haute flottante ; chip de focus juste dessous. */}
      <div className="pointer-events-none absolute left-4 top-16 z-10 flex max-w-[50%] flex-col items-start gap-2">
        <div className="pointer-events-auto [text-shadow:var(--canvas-text-shadow)]">{title}</div>
        {focus && focusEntity ? (
          <div
            className={cn(
              "pointer-events-auto flex items-center gap-1 rounded-full py-0.5 pl-3 pr-1 text-xs text-foreground",
              GLASS_SURFACE,
            )}
          >
            <span>
              {focus.mode === "isolate" ? "Isolé" : "Masqué"} : {focusEntity.name} ·{" "}
              {depthLabel(focus.depth)}
              {visibility.focusStatus === "ignored" ? " (entrée filtrée)" : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={focus.mode === "isolate" ? "Sortir de l'isolement" : "Ne plus masquer"}
              onClick={() => setFilters({ ...filters, focus: null })}
            >
              <X aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      {/* Rangee d'outils (haut droite) : chaque pilule ouvre son panneau
          dessous, un seul a la fois ; Echap ferme et rend le focus a la
          pilule. */}
      <div
        className="pointer-events-none absolute bottom-60 right-3 top-16 z-10 flex w-[300px] flex-col items-end gap-2"
        onKeyDown={(event) => {
          if (event.key === "Escape" && openTool) {
            event.stopPropagation();
            const pill = document.getElementById(`constellation-tool-${openTool}`);
            setOpenTool(null);
            pill?.focus();
          }
        }}
      >
        <div className="pointer-events-auto flex gap-1.5">
          {TOOLS.map((tool) => (
            <Button
              key={tool.id}
              id={`constellation-tool-${tool.id}`}
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={openTool === tool.id}
              aria-controls={`constellation-panel-${tool.id}`}
              onClick={() => setOpenTool((current) => (current === tool.id ? null : tool.id))}
              className={cn(
                "rounded-full text-foreground",
                GLASS_SURFACE,
                openTool === tool.id && "border-foreground",
              )}
            >
              {tool.label}
            </Button>
          ))}
        </div>
        {TOOLS.map((tool) => (
          <section
            key={tool.id}
            id={`constellation-panel-${tool.id}`}
            aria-labelledby={`constellation-tool-${tool.id}`}
            hidden={openTool !== tool.id}
            className={cn(
              "themed-scrollbar pointer-events-auto max-h-full w-full overflow-y-auto rounded-md p-3 text-foreground",
              GLASS_SURFACE,
            )}
          >
            {/* Un seul enfant par panneau : `recent` est un element rendu
                serveur, jamais place dans un tableau d'enfants sans cle. */}
            {toolContent(tool.id)}
          </section>
        ))}
      </div>

      {/* Creation (bas droite) : bouton rond d'accent, plus grand que les
          controles de vue et centre sur leur colonne. */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col items-center gap-2">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <CreateEntityDialog
              worldId={worldId}
              worldSlug={worldSlug}
              open={createOpen}
              onOpenChange={setCreateOpen}
              trigger={
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    aria-label="Nouvelle entrée"
                    data-testid="dashboard-create-entity-trigger"
                    className="size-12 rounded-full shadow-lg"
                  >
                    <span aria-hidden="true" className="relative">
                      <Sparkle className="size-5" />
                      <Plus className="absolute -right-2 -top-2 size-3" strokeWidth={3} />
                    </span>
                  </Button>
                </TooltipTrigger>
              }
            />
            <TooltipContent side="left">Nouvelle entrée (N)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <GraphControls
          onZoomIn={() => graphRef.current?.zoomIn()}
          onZoomOut={() => graphRef.current?.zoomOut()}
          onFit={() => graphRef.current?.fit()}
          onReorganize={reorganize}
        />
      </div>

      {selectedEntity && cardPosition ? (
        <div
          ref={cardRef}
          className="absolute z-20"
          style={{ left: cardPosition.left, top: cardPosition.top }}
        >
          <GraphSelectionCard
            key={selectedEntity.id}
            worldSlug={worldSlug}
            entity={selectedEntity}
            onFocus={(mode, depth) => applyFocus(selectedEntity.id, mode, depth)}
            onClose={() => setSelectedId(null)}
          />
        </div>
      ) : null}

      <ConstellationToasts toasts={toasts} onDismiss={dismiss} />

      {linkA && linkB ? (
        <RelationFromGraphDialog
          worldId={worldId}
          worldSlug={worldSlug}
          catalog={relationCatalog}
          a={linkA}
          b={linkB}
          onClose={closeLink}
          onCreated={closeLink}
        />
      ) : null}
    </div>
  );
}
