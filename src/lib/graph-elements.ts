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
  // mutual : les deux entites se mentionnent l'une l'autre (relation dans les
  // deux sens) - un seul lien affiche pour la paire (cf. commentaire plus
  // bas), jamais deux lignes distinctes pour la meme paire.
  outgoing: { id: string; name: string; mutual: boolean }[];
}

// Depart CANONIQUE d'une paire (independant de l'ordre source/cible d'une
// relation donnee) - garantit que les deux relations d'une paire mutuelle
// (A->B et B->A) calculent le MEME "proprietaire" quel que soit l'ordre dans
// lequel elles sont parcourues, sinon la paire se retrouverait listee sous
// les deux entites (le doublon qu'on cherche justement a eviter).
function isCanonicalFirst(aId: string, aName: string, bId: string, bName: string): boolean {
  const cmp = aName.localeCompare(bName);
  return cmp !== 0 ? cmp < 0 : aId < bId;
}

// Equivalent textuel du graphe (RGAA) : le canvas Cytoscape n'expose aucun
// element individuel au clavier/lecteur d'ecran (meme parti pris que le
// surlignage live, ADR-0010 - affordance souris + chemin accessible separe).
// Regroupe par entite SOURCE (une entite sans relation sortante n'apparait
// pas comme ligne propre, mais reste atteignable comme cible listee sous une
// autre entite - meme convention d'omission silencieuse que buildGraphElements
// pour une extremite disparue).
//
// Deduplication (retour Aymeric, KAN-36 P5) : la liste ne doit jamais
// "doubler" une paire d'entites, ni parce qu'AUTO et MANUAL coexistent pour le
// MEME sens (buildGraphElements les distingue expres pour le canvas, mais un
// lecteur de la liste textuelle verrait deux fois "-> Cible" identiques), ni
// parce que deux entites se MENTIONNENT MUTUELLEMENT (A->B et B->A existent
// tous les deux comme relations distinctes) - dans ce dernier cas, un seul
// lien est affiche (marque `mutual: true`), range sous l'entite dont le nom
// trie en premier.
export function buildAccessibleGraphEntries(
  entities: GraphEntityInput[],
  relations: GraphRelationInput[],
): AccessibleGraphEntry[] {
  const nameById = new Map(entities.map((entity) => [entity.id, entity.name]));

  // Paires dirigees valides (indep. de l'origine) - sert uniquement a
  // detecter la reciprocite d'une paire, pas a construire les entrees.
  const validDirectedPairs = new Set<string>();
  for (const relation of relations) {
    if (nameById.has(relation.sourceId) && nameById.has(relation.targetId)) {
      validDirectedPairs.add(`${relation.sourceId}->${relation.targetId}`);
    }
  }

  // Map imbriquee (proprietaire -> cible -> entree) : la cle interne dedupe
  // naturellement plusieurs relations pour la MEME paire (multi-origine ou
  // parcours des deux sens d'une paire mutuelle), .set() ecrasant simplement
  // la meme cle au lieu d'empiler un doublon.
  const outgoingByOwner = new Map<
    string,
    Map<string, { id: string; name: string; mutual: boolean }>
  >();

  for (const relation of relations) {
    const sourceName = nameById.get(relation.sourceId);
    const targetName = nameById.get(relation.targetId);
    if (sourceName === undefined || targetName === undefined) {
      continue;
    }

    const mutual = validDirectedPairs.has(`${relation.targetId}->${relation.sourceId}`);
    const sourceIsOwner =
      !mutual || isCanonicalFirst(relation.sourceId, sourceName, relation.targetId, targetName);
    const [ownerId, otherId, otherName] = sourceIsOwner
      ? [relation.sourceId, relation.targetId, targetName]
      : [relation.targetId, relation.sourceId, sourceName];

    const owned = outgoingByOwner.get(ownerId) ?? new Map();
    owned.set(otherId, { id: otherId, name: otherName, mutual });
    outgoingByOwner.set(ownerId, owned);
  }

  return entities
    .flatMap((entity) => {
      const outgoing = outgoingByOwner.get(entity.id);
      if (!outgoing || outgoing.size === 0) {
        return [];
      }
      return [
        {
          id: entity.id,
          name: entity.name,
          outgoing: [...outgoing.values()].sort((a, b) => a.name.localeCompare(b.name)),
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
