// Placement de la carte de selection de la Constellation (KAN-87, retour de
// recette) : a cote de l'etoile cliquee, du cote qui masque le MOINS
// d'elements voisins (etoiles, milieux d'aretes). TS pur, testable isolement.

export type Rect = { x1: number; y1: number; x2: number; y2: number };
export type CardSide = "right" | "left" | "above" | "below";

// Ordre de preference a egalite : droite, gauche, dessus, dessous.
const SIDES: readonly CardSide[] = ["right", "left", "above", "below"];

function intersects(a: Rect, b: Rect): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function chooseCardPlacement({
  anchor,
  card,
  container,
  obstacles,
  gap = 12,
  margin = 8,
  topInset = 0,
}: {
  anchor: Rect;
  card: { width: number; height: number };
  container: { width: number; height: number };
  obstacles: readonly Rect[];
  gap?: number;
  margin?: number;
  // Bande haute reservee (barre haute flottante).
  topInset?: number;
}): { left: number; top: number; side: CardSide } {
  const centerX = (anchor.x1 + anchor.x2) / 2;
  const centerY = (anchor.y1 + anchor.y2) / 2;
  const raw: Record<CardSide, { left: number; top: number }> = {
    right: { left: anchor.x2 + gap, top: centerY - card.height / 2 },
    left: { left: anchor.x1 - gap - card.width, top: centerY - card.height / 2 },
    above: { left: centerX - card.width / 2, top: anchor.y1 - gap - card.height },
    below: { left: centerX - card.width / 2, top: anchor.y2 + gap },
  };

  const candidates = SIDES.map((side) => {
    const left = clamp(raw[side].left, margin, container.width - margin - card.width);
    const top = clamp(raw[side].top, topInset + margin, container.height - margin - card.height);
    const rect = { x1: left, y1: top, x2: left + card.width, y2: top + card.height };
    // L'etoile elle-meme ne doit jamais etre couverte : penalite maximale.
    const coversAnchor = intersects(rect, anchor);
    const covered = obstacles.filter((obstacle) => intersects(rect, obstacle)).length;
    return { left, top, side, score: (coversAnchor ? obstacles.length + 1 : 0) + covered };
  });
  // reduce : a score egal, le premier cote dans l'ordre de preference gagne.
  const best = candidates.reduce((kept, candidate) =>
    candidate.score < kept.score ? candidate : kept,
  );
  return { left: best.left, top: best.top, side: best.side };
}
