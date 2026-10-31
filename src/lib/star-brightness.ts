// Eclat des etoiles de la Constellation (KAN-85, ADR-0033) : une entree tres
// liee brille davantage (taille + intensite du halo). Le nombre de VOISINS
// DISTINCTS compte (relations declarees et liens du texte confondus - une
// arete par paire, graph-elements.ts) ; l'echelle est logarithmique pour
// qu'une entree a 30 liens ne devienne pas enorme.

export type BrightnessTier = 0 | 1 | 2 | 3;

// Paliers : 0 = isolee ; 1 = 1 a 4 voisins ; 2 = 5 a 11 ; 3 = 12 et plus.
// Bornes en progression ~x2,4 (echelle logarithmique) ; un palier plafonne
// la taille, une entree a 30 liens reste au palier 3. Affinees a la
// validation C2 : avec 4 / 16, 70 % d'un monde realiste tombait au palier 2
// et le niveau de detail des noms (sky-detail.ts) ne pouvait plus les
// reveler par vagues.
export const TIER_MIN_NEIGHBOURS = { 1: 1, 2: 5, 3: 12 } as const;

export function brightnessTier(neighbourCount: number): BrightnessTier {
  if (!Number.isFinite(neighbourCount) || neighbourCount < TIER_MIN_NEIGHBOURS[1]) {
    return 0;
  }
  if (neighbourCount >= TIER_MIN_NEIGHBOURS[3]) {
    return 3;
  }
  return neighbourCount >= TIER_MIN_NEIGHBOURS[2] ? 2 : 1;
}

// Voisins distincts par entree, a partir d'aretes non orientees. Une boucle
// (source = cible) ne compte pas.
export function neighbourCounts(
  edges: readonly { source: string; target: string }[],
): Map<string, number> {
  const neighbours = new Map<string, Set<string>>();
  const add = (from: string, to: string) => {
    const set = neighbours.get(from) ?? new Set<string>();
    set.add(to);
    neighbours.set(from, set);
  };
  for (const { source, target } of edges) {
    if (source !== target) {
      add(source, target);
      add(target, source);
    }
  }
  return new Map([...neighbours].map(([id, set]) => [id, set.size]));
}

// Rendu par palier (pixels du graphe, avant zoom) : diametre du coeur, marge
// du halo autour du coeur, part de --sky-halo-opacity appliquee au halo.
export const STAR_TIERS: Record<
  BrightnessTier,
  { size: number; haloPadding: number; haloShare: number }
> = {
  0: { size: 8, haloPadding: 3, haloShare: 0.35 },
  1: { size: 11, haloPadding: 5, haloShare: 0.55 },
  2: { size: 15, haloPadding: 8, haloShare: 0.8 },
  3: { size: 20, haloPadding: 12, haloShare: 1 },
};

export function isBrightnessTier(value: unknown): value is BrightnessTier {
  return value === 0 || value === 1 || value === 2 || value === 3;
}
