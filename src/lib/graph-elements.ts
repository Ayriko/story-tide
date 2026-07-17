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
