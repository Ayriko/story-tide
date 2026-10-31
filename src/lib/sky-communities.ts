// Constellations du ciel (KAN-85, retour de validation C2) : groupes
// d'entrees fortement liees entre elles, pour que la disposition les montre
// comme des figures separees par du vide. Graphe pondere : une relation
// declaree pese 2, un lien du texte 1.
//
// Algorithme de Louvain (optimisation de la modularite par deplacements
// locaux puis agregation), zero dependance, DETERMINISTE : noeuds parcourus
// dans l'ordre de leurs id, egalites tranchees par la plus petite
// communaute - le meme monde donne toujours les memes constellations, quel
// que soit l'ordre des donnees recues. (Une propagation d'etiquettes,
// essayee d'abord, morcelait le monde de test : 58 groupes pour 5 grappes.)

export const DECLARED_WEIGHT = 2;
export const TEXT_WEIGHT = 1;
const MAX_LEVELS = 10;
const MAX_PASSES = 50;

export type WeightedEdge = { source: string; target: string; weight: number };

// Graphe d'un niveau : noeuds 0..n-1, voisinage pondere (boucle = poids
// interne d'une communaute agregee, comptee une fois).
type Level = { size: number; neighbours: Map<number, number>[] };

function degrees(level: Level): number[] {
  return level.neighbours.map((neighbours, node) => {
    let degree = 0;
    for (const [other, weight] of neighbours) {
      degree += other === node ? 2 * weight : weight;
    }
    return degree;
  });
}

// Phase 1 : deplacements locaux tant que la modularite augmente. Rend la
// communaute (indice) de chaque noeud du niveau.
function localMoves(level: Level, totalWeight: number): number[] {
  const degree = degrees(level);
  const community = level.neighbours.map((_, node) => node);
  const communityDegree = [...degree];
  const twoM = 2 * totalWeight;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let moved = false;
    for (let node = 0; node < level.size; node += 1) {
      const own = community[node] ?? node;
      const nodeDegree = degree[node] ?? 0;
      const links = new Map<number, number>();
      for (const [other, weight] of level.neighbours[node] ?? []) {
        if (other !== node) {
          const target = community[other] ?? other;
          links.set(target, (links.get(target) ?? 0) + weight);
        }
      }
      communityDegree[own] = (communityDegree[own] ?? 0) - nodeDegree;
      // Gain (a une constante pres) de rejoindre la communaute c.
      const gain = (c: number) =>
        (links.get(c) ?? 0) - ((communityDegree[c] ?? 0) * nodeDegree) / twoM;
      let best = own;
      let bestGain = gain(own);
      for (const candidate of [...links.keys()].sort((a, b) => a - b)) {
        const value = gain(candidate);
        if (value > bestGain + 1e-12) {
          best = candidate;
          bestGain = value;
        }
      }
      communityDegree[best] = (communityDegree[best] ?? 0) + nodeDegree;
      if (best !== own) {
        community[node] = best;
        moved = true;
      }
    }
    if (!moved) {
      break;
    }
  }
  return community;
}

export function detectCommunities(
  nodeIds: readonly string[],
  edges: readonly WeightedEdge[],
): Map<string, string> {
  const ids = [...new Set(nodeIds)].sort();
  const index = new Map(ids.map((id, i) => [id, i]));
  let level: Level = { size: ids.length, neighbours: ids.map(() => new Map()) };
  let totalWeight = 0;
  for (const { source, target, weight } of edges) {
    const a = index.get(source);
    const b = index.get(target);
    if (a === undefined || b === undefined || a === b || !(weight > 0)) {
      continue;
    }
    totalWeight += weight;
    level.neighbours[a]?.set(b, (level.neighbours[a]?.get(b) ?? 0) + weight);
    level.neighbours[b]?.set(a, (level.neighbours[b]?.get(a) ?? 0) + weight);
  }

  // membership[i] : noeud du niveau courant qui contient l'entree i.
  let membership = ids.map((_, i) => i);
  if (totalWeight > 0) {
    for (let depth = 0; depth < MAX_LEVELS; depth += 1) {
      const community = localMoves(level, totalWeight);
      // Renumerotation compacte, dans l'ordre d'apparition (deterministe).
      const renumber = new Map<number, number>();
      for (const c of community) {
        if (!renumber.has(c)) {
          renumber.set(c, renumber.size);
        }
      }
      if (renumber.size === level.size) {
        break;
      }
      membership = membership.map((node) => renumber.get(community[node] ?? node) ?? 0);
      // Phase 2 : agregation des communautes en super-noeuds.
      const aggregated: Level = {
        size: renumber.size,
        neighbours: Array.from({ length: renumber.size }, () => new Map<number, number>()),
      };
      level.neighbours.forEach((neighbours, node) => {
        const from = renumber.get(community[node] ?? node) ?? 0;
        for (const [other, weight] of neighbours) {
          if (other < node) {
            continue;
          }
          const to = renumber.get(community[other] ?? other) ?? 0;
          const target = aggregated.neighbours[from];
          target?.set(to, (target.get(to) ?? 0) + weight);
          if (from !== to) {
            const back = aggregated.neighbours[to];
            back?.set(from, (back.get(from) ?? 0) + weight);
          }
        }
      });
      level = aggregated;
    }
  }

  // Etiquette d'une communaute = plus petit id de ses membres (stable).
  const firstId = new Map<number, string>();
  ids.forEach((id, i) => {
    const c = membership[i] ?? i;
    if (!firstId.has(c)) {
      firstId.set(c, id);
    }
  });
  return new Map(ids.map((id, i) => [id, firstId.get(membership[i] ?? i) ?? id]));
}

// Communautes en groupes, la plus grande d'abord (taille puis etiquette).
export function communityGroups(communities: ReadonlyMap<string, string>): string[][] {
  const groups = new Map<string, string[]>();
  for (const [id, community] of communities) {
    groups.set(community, [...(groups.get(community) ?? []), id]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
    .map(([, members]) => members.sort());
}
