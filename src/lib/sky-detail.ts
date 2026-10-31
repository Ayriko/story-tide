import type { BrightnessTier } from "./star-brightness";

// Niveau de detail du ciel selon le zoom (KAN-85, retour de validation C2 :
// « dezoomer, c'est lever les yeux »). Vue d'ensemble : seuls les noms des
// etoiles les plus brillantes ; en zoomant, les paliers suivants
// apparaissent un par un. Le zoom est RELATIF au zoom « ajuster » du monde
// (jamais une valeur absolue : un grand monde s'ajuste plus loin qu'un
// petit). Fonctions pures ; graph-view.tsx applique par classes.

// Monde de petite taille : tous les noms, quel que soit le zoom.
export const SMALL_WORLD_STARS = 50;
// Libelles de relation au zoom (seuil de C1) seulement si le monde a peu de
// lignes visibles ; au-dela, survol et selection uniquement.
export const DENSE_EDGE_LIMIT = 40;

// Zoom relatif a partir duquel chaque palier est nomme (facteur ~√2 entre
// deux paliers). Le palier 3 l'est toujours.
export const NAME_TIER_THRESHOLDS: Record<Exclude<BrightnessTier, 3>, number> = {
  2: 1.4,
  1: 2,
  0: 2.8,
};

export function relativeZoom(zoom: number, fitZoom: number): number {
  if (!Number.isFinite(zoom) || !Number.isFinite(fitZoom) || fitZoom <= 0 || zoom <= 0) {
    return 1;
  }
  return zoom / fitZoom;
}

// Plus petit palier dont les noms sont affiches a ce zoom relatif.
export function minNamedTier(relZoom: number): BrightnessTier {
  if (relZoom >= NAME_TIER_THRESHOLDS[0]) {
    return 0;
  }
  if (relZoom >= NAME_TIER_THRESHOLDS[1]) {
    return 1;
  }
  if (relZoom >= NAME_TIER_THRESHOLDS[2]) {
    return 2;
  }
  return 3;
}

export function isNameVisible(
  tier: BrightnessTier,
  relZoom: number,
  visibleStarCount: number,
): boolean {
  return visibleStarCount <= SMALL_WORLD_STARS || tier >= minNamedTier(relZoom);
}

export function edgeLabelsFollowZoom(visibleEdgeCount: number): boolean {
  return visibleEdgeCount <= DENSE_EDGE_LIMIT;
}
