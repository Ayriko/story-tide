import type { RelationOrigin } from "@/generated/prisma/client";
import { labelFrom, type ResolvedRelationType } from "./relation-types";

// Fonction pure (KAN-25) : aucune dependance a cytoscape ni au DOM - testable
// isolement, meme patron que resolveLinks/filterMentionSuggestions (logique
// separee de son wiring framework). Convertit les entites + relations d'un
// monde en elements au format attendu par Cytoscape (data-only, pas de
// positions - le layout par defaut de Cytoscape s'en charge cote client).

// Type deja RESOLU par l'appelant (resolveEntityType, KAN-81) : cette
// fonction reste pure, sans catalogue de types a connaitre.
export interface GraphEntityInput {
  id: string;
  name: string;
  typeKey: string;
  typeLabel: string;
  group: string;
}

export interface GraphRelationInput {
  sourceId: string;
  targetId: string;
  origin: RelationOrigin;
}

// Relation DECLAREE (KAN-84), type deja resolu par le service - jamais de
// champ de type brut ici.
export interface GraphDeclaredInput {
  sourceId: string;
  targetId: string;
  relationType: ResolvedRelationType;
}

export interface GraphNodeElement {
  // typeKey : cle resolue (native ou `custom:<id>`) lue par le filtre ;
  // group : couleur du noeud (par groupe, inchange).
  data: { id: string; label: string; typeKey: string; group: string };
}

// Type porte par une arete declaree : tout ce qu'il faut au lot C pour styler
// par type sans toucher au modele (sourceId = source REELLE de la relation,
// qui peut differer de la source de l'arete).
export interface GraphEdgeRelationType {
  key: string;
  label: string;
  inverseLabel: string | null;
  symmetric: boolean;
  sourceId: string;
}

export interface GraphEdgeElement {
  data: {
    id: string;
    source: string;
    target: string;
    // declared : au moins une relation declaree sur la paire (trait plein +
    // libelle) ; text : seulement des reflets du texte (pointilles).
    kind: "declared" | "text";
    // Fleche seulement si TOUTES les relations dirigees (ou les mentions) de
    // la paire vont dans le meme sens - la source de l'arete suit ce sens.
    arrow: boolean;
    // Libelles lus depuis la source de l'arete, joints par « · » ; vide pour
    // une arete texte.
    label: string;
    relationTypes: GraphEdgeRelationType[];
  };
}

export interface GraphElements {
  nodes: GraphNodeElement[];
  edges: GraphEdgeElement[];
}

// Une paire NON ORDONNEE {a, b} (a < b par id) et tout ce qui la relie.
interface Pair {
  a: string;
  b: string;
  textDirections: Set<string>;
  declared: GraphDeclaredInput[];
}

interface PairEdge {
  a: string;
  b: string;
  source: string;
  target: string;
  kind: "declared" | "text";
  arrow: boolean;
  declared: GraphDeclaredInput[];
}

// Regroupe reflets du texte et relations declarees par paire (une seule
// arete par paire, KAN-84). Ordre stable : premiere apparition, reflets du
// texte puis relations declarees, chacun dans l'ordre (stable) du service -
// le layout "cose" depend de l'ordre des aretes (KAN-36 P5). Une extremite
// inconnue (entite disparue) est omise silencieusement.
function buildPairEdges(
  entities: GraphEntityInput[],
  relations: GraphRelationInput[],
  declared: GraphDeclaredInput[],
): PairEdge[] {
  const knownEntityIds = new Set(entities.map((entity) => entity.id));
  const pairs = new Map<string, Pair>();
  const pairOf = (sourceId: string, targetId: string): Pair | null => {
    if (sourceId === targetId || !knownEntityIds.has(sourceId) || !knownEntityIds.has(targetId)) {
      return null;
    }
    const a = sourceId < targetId ? sourceId : targetId;
    const b = a === sourceId ? targetId : sourceId;
    const key = `${a}~${b}`;
    const existing = pairs.get(key);
    if (existing) {
      return existing;
    }
    const created: Pair = { a, b, textDirections: new Set(), declared: [] };
    pairs.set(key, created);
    return created;
  };

  for (const relation of relations) {
    pairOf(relation.sourceId, relation.targetId)?.textDirections.add(relation.sourceId);
  }
  for (const relation of declared) {
    pairOf(relation.sourceId, relation.targetId)?.declared.push(relation);
  }

  return [...pairs.values()].map((pair) => {
    const kind = pair.declared.length > 0 ? "declared" : "text";
    // Sens portes par la paire : sources des relations declarees DIRIGEES
    // (une symetrique n'a pas de sens), ou sources des mentions pour une
    // arete texte (AUTO et MANUAL confondus).
    const directions =
      kind === "declared"
        ? new Set(
            pair.declared
              .filter((relation) => !relation.relationType.symmetric)
              .map((relation) => relation.sourceId),
          )
        : pair.textDirections;
    const onlyDirection = directions.size === 1 ? [...directions][0] : undefined;
    const source = onlyDirection ?? pair.a;
    return {
      a: pair.a,
      b: pair.b,
      source,
      target: source === pair.a ? pair.b : pair.a,
      kind,
      arrow: onlyDirection !== undefined,
      declared: pair.declared,
    };
  });
}

// Libelles des relations declarees lus depuis `viewpointId`, sans doublon.
function declaredLabel(declared: GraphDeclaredInput[], viewpointId: string): string {
  const labels = declared.map((relation) =>
    labelFrom(relation.relationType, relation.sourceId === viewpointId ? "source" : "target"),
  );
  return [...new Set(labels)].join(" · ");
}

export function buildGraphElements(
  entities: GraphEntityInput[],
  relations: GraphRelationInput[],
  declared: GraphDeclaredInput[] = [],
): GraphElements {
  const nodes = entities.map((entity) => ({
    data: { id: entity.id, label: entity.name, typeKey: entity.typeKey, group: entity.group },
  }));

  // UNE arete par paire non ordonnee (KAN-84) : une relation declaree sur la
  // paire masque ses reflets du texte, et AUTO + MANUAL ne font qu'un trait.
  const edges = buildPairEdges(entities, relations, declared).map((edge) => ({
    data: {
      id: `pair:${edge.a}~${edge.b}`,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      arrow: edge.arrow,
      label: declaredLabel(edge.declared, edge.source),
      relationTypes: edge.declared.map((relation) => ({
        key: relation.relationType.key,
        label: relation.relationType.label,
        inverseLabel: relation.relationType.inverseLabel,
        symmetric: relation.relationType.symmetric,
        sourceId: relation.sourceId,
      })),
    },
  }));

  return { nodes, edges };
}

export interface AccessibleGraphEntry {
  id: string;
  name: string;
  // Libelle du type resolu (KAN-81) - equivalent textuel de la couleur.
  typeLabel: string;
  // mutual : la paire n'a pas de sens unique (mentions mutuelles, relation
  // symetrique, sens opposes) - un seul lien pour la paire, jamais deux
  // lignes. relationLabel : libelles declares lus depuis l'entite
  // proprietaire (vide pour un simple reflet du texte).
  outgoing: {
    id: string;
    name: string;
    typeLabel: string;
    mutual: boolean;
    relationLabel: string;
  }[];
}

// Depart CANONIQUE d'une paire sans sens unique : l'entite dont le nom trie
// en premier (puis l'id), quel que soit l'ordre de parcours.
function isCanonicalFirst(aId: string, aName: string, bId: string, bName: string): boolean {
  const cmp = aName.localeCompare(bName);
  return cmp !== 0 ? cmp < 0 : aId < bId;
}

// Equivalent textuel du graphe (RGAA) : le canvas Cytoscape n'expose aucun
// element individuel au clavier/lecteur d'ecran (meme parti pris que le
// surlignage live, ADR-0010 - affordance souris + chemin accessible separe).
// Regroupe par entite proprietaire du lien (une entite sans lien propre
// n'apparait pas comme ligne, mais reste atteignable comme cible listee sous
// une autre).
//
// MEME REGLE que le canvas (KAN-84) : une entree par paire. Paire a sens
// unique (fleche) : rangee sous sa source. Paire sans sens unique : `mutual`,
// rangee sous l'entite dont le nom trie en premier. Les libelles declares,
// lus depuis l'entite proprietaire, priment sur le simple reflet du texte.
export function buildAccessibleGraphEntries(
  entities: GraphEntityInput[],
  relations: GraphRelationInput[],
  declared: GraphDeclaredInput[] = [],
): AccessibleGraphEntry[] {
  const nameById = new Map(entities.map((entity) => [entity.id, entity.name]));
  const typeLabelById = new Map(entities.map((entity) => [entity.id, entity.typeLabel]));
  const outgoingByOwner = new Map<string, AccessibleGraphEntry["outgoing"]>();

  for (const edge of buildPairEdges(entities, relations, declared)) {
    const aName = nameById.get(edge.a) ?? "";
    const bName = nameById.get(edge.b) ?? "";
    let ownerId = edge.source;
    if (!edge.arrow) {
      ownerId = isCanonicalFirst(edge.a, aName, edge.b, bName) ? edge.a : edge.b;
    }
    const otherId = ownerId === edge.a ? edge.b : edge.a;
    const owned = outgoingByOwner.get(ownerId) ?? [];
    owned.push({
      id: otherId,
      name: nameById.get(otherId) ?? "",
      typeLabel: typeLabelById.get(otherId) ?? "",
      mutual: !edge.arrow,
      relationLabel: declaredLabel(edge.declared, ownerId),
    });
    outgoingByOwner.set(ownerId, owned);
  }

  return entities
    .flatMap((entity) => {
      const outgoing = outgoingByOwner.get(entity.id);
      if (!outgoing || outgoing.length === 0) {
        return [];
      }
      return [
        {
          id: entity.id,
          name: entity.name,
          typeLabel: entity.typeLabel,
          outgoing: [...outgoing].sort((a, b) => a.name.localeCompare(b.name)),
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
