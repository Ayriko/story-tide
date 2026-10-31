// Calendrier de l'arrivee dans un monde (KAN-85, animation signature 1) :
// les etoiles s'allument par ordre d'eclat decroissant (les plus liees
// d'abord), PAR PAQUETS (jamais un minuteur par etoile), puis les lignes
// declarees se tracent d'une etoile a l'autre. ~1 s au total quel que soit le
// nombre d'entrees. Fonction pure : le composant ne fait qu'appliquer.

// Fondu d'un paquet d'etoiles (= transition de style du ciel) et trace d'une
// ligne.
export const ARRIVAL_FADE_MS = 150;
export const ARRIVAL_TRACE_MS = 250;
// Fin de la phase des etoiles (dernier fondu termine) ; les lignes suivent.
const STAR_PHASE_MS = 600;
const MAX_STAR_BATCHES = 8;
const MAX_LINE_BATCHES = 4;
// Dernier trace demarre au plus tard ici : 750 + 250 = 1000 ms.
const LINE_PHASE_LAST_START_MS = 750;

export type ArrivalBatch = { atMs: number; ids: string[] };
export type ArrivalSchedule = {
  starBatches: ArrivalBatch[];
  // Lignes declarees, tracees de la source vers la cible.
  lineBatches: ArrivalBatch[];
  // Liens du texte : fondu unique, en meme temps que le premier trace.
  textEdges: ArrivalBatch | null;
  totalMs: number;
};

export type ArrivalInput = {
  // brightness : nombre de voisins distincts (eclat) ; tier : palier.
  stars: readonly { id: string; tier: number; brightness: number }[];
  declaredEdges: readonly { id: string; source: string; target: string }[];
  textEdgeIds: readonly string[];
  reducedMotion: boolean;
};

export const EMPTY_ARRIVAL: ArrivalSchedule = {
  starBatches: [],
  lineBatches: [],
  textEdges: null,
  totalMs: 0,
};

// Decoupe en `count` paquets de tailles egales a une unite pres, dans l'ordre.
function chunk<T>(items: readonly T[], count: number): T[][] {
  const chunks: T[][] = [];
  const size = items.length / count;
  for (let i = 0; i < count; i += 1) {
    chunks.push(items.slice(Math.round(i * size), Math.round((i + 1) * size)));
  }
  return chunks.filter((part) => part.length > 0);
}

// Instants de depart repartis de `from` a `to` (bornes incluses).
function spread(count: number, from: number, to: number): number[] {
  if (count <= 1) {
    return [from];
  }
  return Array.from({ length: count }, (_, i) =>
    Math.round(from + ((to - from) * i) / (count - 1)),
  );
}

export function arrivalSchedule(input: ArrivalInput): ArrivalSchedule {
  if (input.reducedMotion || input.stars.length === 0) {
    return EMPTY_ARRIVAL;
  }

  const ordered = [...input.stars].sort(
    (a, b) =>
      b.tier - a.tier || b.brightness - a.brightness || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const starChunks = chunk(ordered, Math.min(MAX_STAR_BATCHES, ordered.length));
  const starStarts = spread(starChunks.length, 0, STAR_PHASE_MS - ARRIVAL_FADE_MS);
  const starBatches = starChunks.map((stars, i) => ({
    atMs: starStarts[i] ?? 0,
    ids: stars.map((star) => star.id),
  }));

  // Lignes : celles des etoiles allumees le plus tot d'abord (rang de
  // l'extremite la plus brillante).
  const rank = new Map(ordered.map((star, index) => [star.id, index]));
  const rankOf = (id: string) => rank.get(id) ?? ordered.length;
  const lines = [...input.declaredEdges].sort(
    (a, b) =>
      Math.min(rankOf(a.source), rankOf(a.target)) - Math.min(rankOf(b.source), rankOf(b.target)) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const lineChunks = chunk(lines, Math.min(MAX_LINE_BATCHES, lines.length));
  const lineStarts = spread(lineChunks.length, STAR_PHASE_MS, LINE_PHASE_LAST_START_MS);
  const lineBatches = lineChunks.map((edges, i) => ({
    atMs: lineStarts[i] ?? STAR_PHASE_MS,
    ids: edges.map((edge) => edge.id),
  }));

  const textEdges =
    input.textEdgeIds.length > 0 ? { atMs: STAR_PHASE_MS, ids: [...input.textEdgeIds] } : null;

  const lastLine = lineBatches[lineBatches.length - 1];
  const totalMs = lastLine
    ? lastLine.atMs + ARRIVAL_TRACE_MS
    : textEdges
      ? STAR_PHASE_MS + ARRIVAL_FADE_MS
      : STAR_PHASE_MS;
  return { starBatches, lineBatches, textEdges, totalMs };
}
