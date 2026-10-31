import { z } from "zod";
import type { GraphElements } from "./graph-elements";

// Filtres de la Constellation (KAN-87, ADR-0032) : calcul de visibilite pur,
// partage par le canvas et la liste accessible (memes filtres des deux
// cotes). Aucune dependance a cytoscape ni au DOM.

// Cle du filtre « Liens du texte » (aretes AUTO/MANUAL), a cote des cles de
// types de relation declares (natives ou `custom:<id>`, jamais "text").
export const TEXT_LINKS_KEY = "text";

export const FOCUS_DEPTHS = [1, 2, 3, "all"] as const;
export type FocusDepth = (typeof FOCUS_DEPTHS)[number];

export type GraphFocus = {
  // isolate : l'entree et ses voisins jusqu'a N sauts ; hide : les cacher.
  mode: "isolate" | "hide";
  entityId: string;
  depth: FocusDepth;
};

export type GraphFilters = {
  hiddenTypeKeys: string[];
  hiddenRelationKeys: string[];
  focus: GraphFocus | null;
  // « Etoiles sans lien » (KAN-85) : entrees sans aucune relation dans le
  // monde (ni declaree ni du texte). Affichees par defaut.
  hideIsolated: boolean;
};

export const DEFAULT_GRAPH_FILTERS: GraphFilters = {
  hiddenTypeKeys: [],
  hiddenRelationKeys: [],
  focus: null,
  hideIsolated: false,
};

// Entrees sans aucun lien dans le monde (toutes aretes confondues, avant
// filtres) : stables quels que soient les autres filtres.
export function isolatedEntryIds(elements: GraphElements): Set<string> {
  const linked = new Set<string>();
  for (const edge of elements.edges) {
    linked.add(edge.data.source);
    linked.add(edge.data.target);
  }
  return new Set(elements.nodes.map((node) => node.data.id).filter((id) => !linked.has(id)));
}

export type GraphVisibility = {
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
  // ignored : entree du focus disparue ou masquee par un filtre de types -
  // le focus ne s'applique pas (jamais d'erreur).
  focusStatus: "none" | "active" | "ignored";
};

// Entrees a distance <= depth de `start` en ne suivant que les aretes
// visibles (parcours en largeur, non oriente).
function neighbourhood(
  start: string,
  depth: FocusDepth,
  adjacency: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const reached = new Set([start]);
  let frontier = [start];
  let distance = 0;
  while (frontier.length > 0 && (depth === "all" || distance < depth)) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbour of adjacency.get(nodeId) ?? []) {
        if (!reached.has(neighbour)) {
          reached.add(neighbour);
          nextFrontier.push(neighbour);
        }
      }
    }
    frontier = nextFrontier;
    distance += 1;
  }
  return reached;
}

// Trois etapes : 1) types d'entree (et etoiles sans lien), 2) types de relation (une arete declaree
// a plusieurs types reste visible si au moins un l'est ; ses deux extremites
// doivent etre visibles), 3) focus (isoler / masquer) parcouru sur les seules
// aretes visibles a l'issue de 2.
export function computeVisibility(elements: GraphElements, filters: GraphFilters): GraphVisibility {
  const hiddenTypes = new Set(filters.hiddenTypeKeys);
  const hiddenRelations = new Set(filters.hiddenRelationKeys);

  const isolated = filters.hideIsolated ? isolatedEntryIds(elements) : new Set<string>();
  const typeVisible = new Set(
    elements.nodes
      .filter((node) => !hiddenTypes.has(node.data.typeKey) && !isolated.has(node.data.id))
      .map((node) => node.data.id),
  );
  const relationVisibleEdges = elements.edges.filter((edge) => {
    if (!typeVisible.has(edge.data.source) || !typeVisible.has(edge.data.target)) {
      return false;
    }
    if (edge.data.kind === "text") {
      return !hiddenRelations.has(TEXT_LINKS_KEY);
    }
    return edge.data.relationTypes.some((type) => !hiddenRelations.has(type.key));
  });

  const focus = filters.focus;
  if (!focus) {
    return {
      nodeIds: typeVisible,
      edgeIds: new Set(relationVisibleEdges.map((edge) => edge.data.id)),
      focusStatus: "none",
    };
  }
  if (!typeVisible.has(focus.entityId)) {
    return {
      nodeIds: typeVisible,
      edgeIds: new Set(relationVisibleEdges.map((edge) => edge.data.id)),
      focusStatus: "ignored",
    };
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of relationVisibleEdges) {
    const { source, target } = edge.data;
    adjacency.set(source, [...(adjacency.get(source) ?? []), target]);
    adjacency.set(target, [...(adjacency.get(target) ?? []), source]);
  }
  const reached = neighbourhood(focus.entityId, focus.depth, adjacency);
  const nodeIds = new Set(
    [...typeVisible].filter((id) =>
      focus.mode === "isolate" ? reached.has(id) : !reached.has(id),
    ),
  );
  const edgeIds = new Set(
    relationVisibleEdges
      .filter((edge) => nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target))
      .map((edge) => edge.data.id),
  );
  return { nodeIds, edgeIds, focusStatus: "active" };
}

export function hasActiveFilters(filters: GraphFilters): boolean {
  return (
    filters.hiddenTypeKeys.length > 0 ||
    filters.hiddenRelationKeys.length > 0 ||
    filters.focus !== null ||
    filters.hideIsolated
  );
}

export type RelationFilterOption = { key: string; label: string };

// Types de relation declares PRESENTS dans le monde (par libelle), puis
// « Liens du texte » si au moins une arete texte existe.
export function relationFilterOptions(elements: GraphElements): RelationFilterOption[] {
  const declared = new Map<string, string>();
  let hasText = false;
  for (const edge of elements.edges) {
    if (edge.data.kind === "text") {
      hasText = true;
    }
    for (const type of edge.data.relationTypes) {
      declared.set(type.key, type.label);
    }
  }
  const options = [...declared]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  return hasText ? [...options, { key: TEXT_LINKS_KEY, label: "Liens du texte" }] : options;
}

const storedFiltersSchema = z.object({
  hiddenTypeKeys: z.array(z.string()).max(500),
  hiddenRelationKeys: z.array(z.string()).max(500),
  focus: z
    .object({
      mode: z.enum(["isolate", "hide"]),
      entityId: z.string().min(1),
      depth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal("all")]),
    })
    .nullable(),
  // Absent d'une valeur memorisee avant KAN-85 : etoiles affichees.
  hideIsolated: z.boolean().default(false),
});

// Valeur lue dans le navigateur : toute valeur absente, illisible ou
// invalide redonne les filtres par defaut, sans erreur.
export function parseStoredFilters(raw: string | null): GraphFilters {
  if (raw === null) {
    return DEFAULT_GRAPH_FILTERS;
  }
  try {
    const parsed = storedFiltersSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_GRAPH_FILTERS;
  } catch {
    return DEFAULT_GRAPH_FILTERS;
  }
}

export function graphFiltersStorageKey(worldId: string): string {
  return `storytide:graph-filters:${worldId}`;
}

export function depthLabel(depth: FocusDepth): string {
  if (depth === "all") {
    return "tous les sauts";
  }
  return depth === 1 ? "1 saut" : `${depth} sauts`;
}

export type EntryTypeFilterGroup = {
  group: string;
  types: { key: string; label: string; count: number }[];
};

// Types d'entree filtrables (retour de recette) : seulement ceux qui ont au
// moins une entree dans le monde, avec leur nombre, et seulement les groupes
// non vides. Groupes dans l'ordre fourni (ENTITY_TYPE_GROUPS), groupe inconnu
// en fin ; types par libelle.
export function entryTypeFilterGroups(
  entries: readonly { typeKey: string; typeLabel: string; group: string }[],
  groupOrder: readonly string[],
): EntryTypeFilterGroup[] {
  const byGroup = new Map<string, Map<string, { key: string; label: string; count: number }>>();
  for (const entry of entries) {
    const types = byGroup.get(entry.group) ?? new Map();
    const type = types.get(entry.typeKey) ?? {
      key: entry.typeKey,
      label: entry.typeLabel,
      count: 0,
    };
    type.count += 1;
    types.set(entry.typeKey, type);
    byGroup.set(entry.group, types);
  }
  const rank = (group: string) => {
    const index = groupOrder.indexOf(group);
    return index === -1 ? groupOrder.length : index;
  };
  return [...byGroup]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "fr"))
    .map(([group, types]) => ({
      group,
      types: [...types.values()].sort((a, b) => a.label.localeCompare(b.label, "fr")),
    }));
}
