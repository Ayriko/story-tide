import type { RelationOrigin } from "@/generated/prisma/client";

// Fonction pure (KAN-25) : aucune dependance a cytoscape ni au DOM - testable
// isolement, meme patron que resolveLinks/filterMentionSuggestions (logique
// separee de son wiring framework). Convertit les entites + relations d'un
// monde en elements au format attendu par Cytoscape (data-only, pas de
// positions - le layout par defaut de Cytoscape s'en charge cote client).

export interface GraphEntityInput {
  id: string;
  name: string;
  type: string;
}

export interface GraphRelationInput {
  sourceId: string;
  targetId: string;
  origin: RelationOrigin;
}

export interface GraphNodeElement {
  data: { id: string; label: string; type: string };
}

export interface GraphEdgeElement {
  data: { id: string; source: string; target: string; origin: RelationOrigin };
}

export interface GraphElements {
  nodes: GraphNodeElement[];
  edges: GraphEdgeElement[];
}

export function buildGraphElements(
  entities: GraphEntityInput[],
  relations: GraphRelationInput[],
): GraphElements {
  const nodes = entities.map((entity) => ({
    data: { id: entity.id, label: entity.name, type: entity.type },
  }));

  // AUTO et MANUAL peuvent coexister pour le meme couple source/cible
  // (@@unique([sourceId, targetId, origin]) - relation-service.ts) : l'id de
  // l'arete inclut donc l'origin, sinon deux relations distinctes produiraient
  // un id d'element Cytoscape duplique.
  const knownEntityIds = new Set(entities.map((entity) => entity.id));
  const edges = relations
    .filter(
      (relation) => knownEntityIds.has(relation.sourceId) && knownEntityIds.has(relation.targetId),
    )
    .map((relation) => ({
      data: {
        id: `${relation.sourceId}->${relation.targetId}:${relation.origin}`,
        source: relation.sourceId,
        target: relation.targetId,
        origin: relation.origin,
      },
    }));

  return { nodes, edges };
}

export interface AccessibleGraphEntry {
  id: string;
  name: string;
  outgoing: { id: string; name: string }[];
}

// Equivalent textuel du graphe (RGAA) : le canvas Cytoscape n'expose aucun
// element individuel au clavier/lecteur d'ecran (meme parti pris que le
// surlignage live, ADR-0010 - affordance souris + chemin accessible separe).
// Regroupe par entite SOURCE (une entite sans relation sortante n'apparait
// pas comme ligne propre, mais reste atteignable comme cible listee sous une
// autre entite - meme convention d'omission silencieuse que buildGraphElements
// pour une extremite disparue).
export function buildAccessibleGraphEntries(
  entities: GraphEntityInput[],
  relations: GraphRelationInput[],
): AccessibleGraphEntry[] {
  const nameById = new Map(entities.map((entity) => [entity.id, entity.name]));

  const outgoingByEntity = new Map<string, { id: string; name: string }[]>();
  for (const relation of relations) {
    const targetName = nameById.get(relation.targetId);
    if (!nameById.has(relation.sourceId) || targetName === undefined) {
      continue;
    }
    const outgoing = outgoingByEntity.get(relation.sourceId) ?? [];
    outgoing.push({ id: relation.targetId, name: targetName });
    outgoingByEntity.set(relation.sourceId, outgoing);
  }

  return entities
    .flatMap((entity) => {
      const outgoing = outgoingByEntity.get(entity.id);
      if (!outgoing || outgoing.length === 0) {
        return [];
      }
      return [
        {
          id: entity.id,
          name: entity.name,
          outgoing: [...outgoing].sort((a, b) => a.name.localeCompare(b.name)),
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
