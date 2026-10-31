// Disposition de la Constellation (KAN-87, ADR-0032) : TS pur, aucune
// dependance a cytoscape ni au DOM - testable isolement (meme patron que
// graph-elements.ts).

// Bornes du zoom, partagees par l'instance Cytoscape (minZoom/maxZoom) et le
// schema Zod du cadrage sauvegarde (board-schemas.ts) : un cadrage hors de ce
// que le graphe sait afficher est refuse a la frontiere.
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export type NodePosition = { x: number; y: number };

export type PlacementPlan = {
  // preset : toutes les etoiles ont une place, rien a calculer.
  // incremental : les nouvelles sont placees autour des places connues, FIXEES.
  // full : aucune place connue (premier passage), mise en page complete.
  mode: "preset" | "incremental" | "full";
  fixed: { nodeId: string; position: NodePosition }[];
  newNodeIds: string[];
};

// Qui est nouveau, qui est fixe. Une place connue d'une entree absente du
// graphe (entree supprimee entre-temps) est ignoree.
export function planPlacement(
  nodeIds: readonly string[],
  known: ReadonlyMap<string, NodePosition>,
): PlacementPlan {
  const fixed: PlacementPlan["fixed"] = [];
  const newNodeIds: string[] = [];
  for (const nodeId of nodeIds) {
    const position = known.get(nodeId);
    if (position) {
      fixed.push({ nodeId, position: { x: position.x, y: position.y } });
    } else {
      newNodeIds.push(nodeId);
    }
  }
  let mode: PlacementPlan["mode"] = "incremental";
  if (newNodeIds.length === 0) {
    mode = "preset";
  } else if (fixed.length === 0) {
    mode = "full";
  }
  return { mode, fixed, newNodeIds };
}

// Options fcose d'un plan incremental ou complet. animate:false : mise en
// page synchrone, aucune frame differee apres un demontage (meme raison que
// l'ancien cose, ADR-0012). fit:false : le cadrage est decide par l'appelant
// (cadrage enregistre ou ajustement a l'ecran), jamais par la mise en page.
//
// Grand monde (KAN-85, retour de validation C2 : le ciel doit occuper
// l'ecran) : au-dela de LARGE_WORLD_ENTRIES, mise en page plus aeree -
// espacement, longueur d'arete et repulsion accrus, gravite reduite.
export const LARGE_WORLD_ENTRIES = 50;

export function fcoseOptions(plan: PlacementPlan, nodeCount = 0) {
  const large = nodeCount > LARGE_WORLD_ENTRIES;
  return {
    name: "fcose",
    animate: false,
    randomize: true,
    fit: false,
    nodeSeparation: large ? 180 : 120,
    idealEdgeLength: () => (large ? 170 : 120),
    nodeRepulsion: () => (large ? 12000 : 4500),
    gravity: large ? 0.12 : 0.25,
    fixedNodeConstraint: plan.mode === "incremental" ? plan.fixed : undefined,
  } as const;
}

// Disposition d'UNE constellation (KAN-85, retour de validation C2) : fcose
// sur la seule communaute, compacte, sans aucune deformation ensuite. Les
// libelles comptent dans la taille des etoiles (nodeDimensionsIncludeLabels)
// quand tous les noms s'affichent (petit monde, sky-detail.ts) : deux noms ne
// se chevauchent plus (« Trone de Cendre » / « Le Reliquaire du Verbe » sur
// Atheraus). Dans un grand monde, les noms sont masques en vue d'ensemble :
// les compter eloignerait la vue (zoom 0,48 au lieu de ~0,55 sur 300).
//
// Densite (retour de validation C2) : l'espacement interne croit avec la
// racine du nombre d'etoiles de la figure - une grande constellation
// respire (ses lignes se lisent), une petite reste compacte.
export function communitySpacing(size: number): number {
  return Math.round(20 + 7 * Math.sqrt(Math.max(size, 1)));
}

export function communityLayoutOptions(includeLabels = true, size = 1) {
  const spacing = communitySpacing(size);
  return {
    name: "fcose",
    animate: false,
    randomize: true,
    fit: false,
    nodeDimensionsIncludeLabels: includeLabels,
    idealEdgeLength: () => spacing,
    nodeRepulsion: () => spacing * 90,
    gravity: 0.35,
    packComponents: true,
  } as const;
}

// Rangement des constellations (KAN-85) : chaque communaute est un BLOC (sa
// boite englobante), range dans les proportions de la scene, sans jamais
// deformer une figure.
// - ordre (communityOrder) : la plus grande d'abord, puis a chaque pas celle
//   qui se parle le plus avec les blocs deja ranges (poids cumule des liens) ;
// - rangees remplies dans cet ordre ; la largeur de rangee retenue est celle
//   qui donne le plus grand zoom « ajuster » dans les proportions de la
//   scene (chaque largeur possible est essayee ; a egalite, moins de rangees) ;
// - dans une rangee, chaque bloc rejoint l'extremite (gauche ou droite) avec
//   laquelle il a le plus de liens : deux blocs fortement relies ne sont
//   jamais separes par un troisieme. Meme regle pour empiler les rangees.
// Marge reguliere entre blocs et entre rangees. Rend le CENTRE de chaque
// bloc, la disposition entiere centree sur l'origine. Deterministe.
export type CommunityBlock = { id: string; width: number; height: number };
export type CommunityLink = { a: string; b: string; weight: number };
export const PACK_MARGIN = 50;

function linkWeights(links: readonly CommunityLink[]) {
  const weight = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? `${a}~${b}` : `${b}~${a}`);
  for (const { a, b, weight: w } of links) {
    if (a !== b && w > 0) {
      weight.set(key(a, b), (weight.get(key(a, b)) ?? 0) + w);
    }
  }
  return (a: string, b: string) => weight.get(key(a, b)) ?? 0;
}

export function communityOrder<T extends CommunityBlock>(
  blocks: readonly T[],
  links: readonly CommunityLink[],
): T[] {
  const between = linkWeights(links);
  const remaining = [...blocks].sort(
    (p, q) => q.width * q.height - p.width * p.height || (p.id < q.id ? -1 : 1),
  );
  const order: T[] = [];
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -1;
    remaining.forEach((candidate, index) => {
      const score = order.reduce((sum, placed) => sum + between(candidate.id, placed.id), 0);
      // `remaining` est trie par aire : a score egal, le plus grand gagne.
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    if (next) {
      order.push(next);
    }
  }
  return order;
}

// Range une suite autour du premier element (qui reste au centre) : chacun
// rejoint l'extremite avec laquelle il a le plus de liens ; a egalite (aucun
// lien compris), le cote qui compte le moins d'elements - la plus grande
// communaute reste au centre de sa rangee.
function affinityArrange<T>(items: readonly T[], affinity: (a: T, b: T) => number): T[] {
  const arranged: T[] = [];
  let leftCount = 0;
  let rightCount = 0;
  for (const item of items) {
    const first = arranged[0];
    const last = arranged[arranged.length - 1];
    const toLeft = first === undefined ? 0 : affinity(item, first);
    const toRight = last === undefined ? 0 : affinity(item, last);
    const goLeft =
      arranged.length > 0 && (toLeft > toRight || (toLeft === toRight && leftCount < rightCount));
    if (goLeft) {
      arranged.unshift(item);
      leftCount += 1;
    } else {
      if (arranged.length > 0) {
        rightCount += 1;
      }
      arranged.push(item);
    }
  }
  return arranged;
}

export function packCommunities(
  blocks: readonly CommunityBlock[],
  links: readonly CommunityLink[],
  targetAspect: number,
  margin = PACK_MARGIN,
): Map<string, NodePosition> {
  if (blocks.length === 0) {
    return new Map();
  }
  const between = linkWeights(links);
  const order = communityOrder(blocks, links);

  // Rangees : chaque largeur de rangee possible (prefixes de l'ordre) est
  // essayee ; on garde celle qui remplit le mieux la scene.
  const aspect = targetAspect > 0 ? targetAspect : 16 / 9;
  const fill = (rowWidth: number) => {
    const filled: CommunityBlock[][] = [];
    let current: CommunityBlock[] = [];
    let currentWidth = 0;
    for (const block of order) {
      const added = currentWidth === 0 ? block.width : currentWidth + margin + block.width;
      if (current.length > 0 && added > rowWidth + 1e-9) {
        filled.push(current);
        current = [block];
        currentWidth = block.width;
      } else {
        current.push(block);
        currentWidth = added;
      }
    }
    filled.push(current);
    return filled;
  };
  const extent = (candidate: CommunityBlock[][]) => ({
    width: Math.max(
      ...candidate.map(
        (row) => row.reduce((sum, b) => sum + b.width, 0) + margin * (row.length - 1),
      ),
    ),
    height:
      candidate.reduce((sum, row) => sum + Math.max(...row.map((b) => b.height)), 0) +
      margin * (candidate.length - 1),
  });
  let rows = fill(Infinity);
  let bestScale = 0;
  let prefix = -margin;
  for (const block of order) {
    prefix += margin + block.width;
    const candidate = fill(prefix);
    const { width, height } = extent(candidate);
    // Zoom relatif possible dans une scene de proportions `aspect`.
    const scale = Math.min(aspect / width, 1 / height);
    // Largeurs croissantes = de moins en moins de rangees : a egalite, la
    // derniere (moins de rangees) l'emporte.
    if (scale >= bestScale - 1e-12) {
      bestScale = scale;
      rows = candidate;
    }
  }

  const rowAffinity = (p: CommunityBlock[], q: CommunityBlock[]) =>
    p.reduce((sum, a) => sum + q.reduce((inner, b) => inner + between(a.id, b.id), 0), 0);
  const arrangedRows = affinityArrange(rows, rowAffinity).map((row) =>
    affinityArrange(row, (a, b) => between(a.id, b.id)),
  );
  const rowHeights = arrangedRows.map((row) => Math.max(...row.map((b) => b.height)));
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + margin * (rows.length - 1);
  const centers = new Map<string, NodePosition>();
  let y = -totalHeight / 2;
  arrangedRows.forEach((row, r) => {
    const height = rowHeights[r] ?? 0;
    const width = row.reduce((sum, b) => sum + b.width, 0) + margin * (row.length - 1);
    let x = -width / 2;
    for (const block of row) {
      centers.set(block.id, { x: x + block.width / 2, y: y + height / 2 });
      x += block.width + margin;
    }
    y += height + margin;
  });
  return centers;
}

// Orientation des constellations (KAN-85, retour de validation C2) : une
// fois les blocs ranges, chacun - dans l'ordre du rangement - essaie les 8
// orientations du carre (rotations de 0, 90, 180 et 270 degres, et leurs
// miroirs) et garde celle qui minimise la longueur totale de ses ponts : vers
// l'etoile elle-meme si son bloc est deja oriente, sinon vers le centre de
// son bloc (sa place est connue apres le rangement) - le premier bloc
// s'oriente donc lui aussi vers ses voisins. Un quart de tour echange largeur et hauteur : il
// n'est essaye que si le bloc tourne tient dans sa place (marge comprise),
// jamais de chevauchement. Deterministe (a egalite, l'ordre de la liste,
// identite d'abord).
export type BlockTransform = { xx: number; xy: number; yx: number; yy: number };
export const BLOCK_TRANSFORMS: readonly BlockTransform[] = [
  { xx: 1, xy: 0, yx: 0, yy: 1 },
  { xx: 0, xy: -1, yx: 1, yy: 0 },
  { xx: -1, xy: 0, yx: 0, yy: -1 },
  { xx: 0, xy: 1, yx: -1, yy: 0 },
  { xx: -1, xy: 0, yx: 0, yy: 1 },
  { xx: 1, xy: 0, yx: 0, yy: -1 },
  { xx: 0, xy: 1, yx: 1, yy: 0 },
  { xx: 0, xy: -1, yx: -1, yy: 0 },
];
const IDENTITY: BlockTransform = { xx: 1, xy: 0, yx: 0, yy: 1 };

export type OrientableBlock = CommunityBlock & {
  // Positions des membres RELATIVES au centre du bloc.
  members: ReadonlyMap<string, NodePosition>;
};

function applyTransform(t: BlockTransform, p: NodePosition): NodePosition {
  return { x: t.xx * p.x + t.xy * p.y, y: t.yx * p.x + t.yy * p.y };
}

export function orientBlocks(
  blocks: readonly OrientableBlock[],
  centers: ReadonlyMap<string, NodePosition>,
  bridges: readonly { a: string; b: string; weight: number }[],
  margin = PACK_MARGIN,
): Map<string, NodePosition> {
  const blockOf = new Map<string, string>();
  for (const block of blocks) {
    for (const memberId of block.members.keys()) {
      blockOf.set(memberId, block.id);
    }
  }
  const bridgesOf = new Map<string, { inside: string; outside: string; weight: number }[]>();
  const links: CommunityLink[] = [];
  for (const { a, b, weight } of bridges) {
    const blockA = blockOf.get(a);
    const blockB = blockOf.get(b);
    if (!blockA || !blockB || blockA === blockB) {
      continue;
    }
    bridgesOf.set(blockA, [...(bridgesOf.get(blockA) ?? []), { inside: a, outside: b, weight }]);
    bridgesOf.set(blockB, [...(bridgesOf.get(blockB) ?? []), { inside: b, outside: a, weight }]);
    links.push({ a: blockA, b: blockB, weight });
  }

  const placed = new Map<string, NodePosition>();
  // Ordre du rangement (memes regles que packCommunities).
  for (const block of communityOrder(blocks, links)) {
    const center = centers.get(block.id);
    if (!center) {
      continue;
    }
    const quarterFits =
      block.height <= block.width + margin && block.width <= block.height + margin;
    let best = IDENTITY;
    let bestCost = Infinity;
    for (const transform of BLOCK_TRANSFORMS) {
      if (transform.xy !== 0 && !quarterFits) {
        continue;
      }
      let cost = 0;
      for (const { inside, outside, weight } of bridgesOf.get(block.id) ?? []) {
        const other = placed.get(outside) ?? centers.get(blockOf.get(outside) ?? "");
        const rel = block.members.get(inside);
        if (!other || !rel) {
          continue;
        }
        const p = applyTransform(transform, rel);
        cost += weight * Math.hypot(center.x + p.x - other.x, center.y + p.y - other.y);
      }
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = transform;
      }
    }
    for (const [memberId, rel] of block.members) {
      const p = applyTransform(best, rel);
      placed.set(memberId, { x: center.x + p.x, y: center.y + p.y });
    }
  }
  return placed;
}

// Finition (KAN-85) : passe fcose COURTE par constellation, partant des
// positions obtenues (aucun nouveau tirage), liens internes forts, ponts
// actifs mais faibles. Les etoiles a l'autre bout des ponts sont FIGEES
// (fixedNodeConstraint) : seules les etoiles du bloc glissent, vers le cote
// qui fait face a leurs ponts. L'appelant recentre ensuite le bloc sur sa
// place du rangement (une passe sur tout le ciel, essayee d'abord, ramassait
// les blocs les uns sur les autres : 1170 x 700 -> 774 x 851).
type LayoutEdge = { source(): { id(): string }; target(): { id(): string } };
// Elasticites ; la longueur interne est celle de la figure (communitySpacing),
// pour que la finition ne la recompacte pas.
export const REFINE_SPRINGS = {
  intra: { elasticity: 0.45 },
  bridge: { length: 40, elasticity: 0.1 },
} as const;

export function refineLayoutOptions(
  communities: ReadonlyMap<string, string>,
  fixed: readonly { nodeId: string; position: NodePosition }[] = [],
  includeLabels = true,
  size = 1,
) {
  const spacing = communitySpacing(size);
  const isBridge = (edge: LayoutEdge) =>
    communities.get(edge.source().id()) !== communities.get(edge.target().id());
  return {
    name: "fcose",
    animate: false,
    randomize: false,
    quality: "default",
    fit: false,
    packComponents: false,
    nodeDimensionsIncludeLabels: includeLabels,
    numIter: 400,
    gravity: 0,
    fixedNodeConstraint: fixed.length > 0 ? [...fixed] : undefined,
    nodeRepulsion: () => spacing * 90,
    idealEdgeLength: (edge: LayoutEdge) =>
      isBridge(edge) ? REFINE_SPRINGS.bridge.length : spacing,
    edgeElasticity: (edge: LayoutEdge) =>
      REFINE_SPRINGS[isBridge(edge) ? "bridge" : "intra"].elasticity,
  } as const;
}

// Etoiles sans lien (KAN-85) : semees sur un arc discret au bord bas du ciel,
// sous les constellations (plus de grille). Ordre des id = ordre sur l'arc.
export const ISOLATED_ARC = { spacing: 70, gap: 80, sagRatio: 0.06 } as const;

export function isolatedArcPositions(
  ids: readonly string[],
  bounds: ViewExtent | null,
): Map<string, NodePosition> {
  const sorted = [...ids].sort();
  const count = sorted.length;
  if (count === 0) {
    return new Map();
  }
  const natural = (count - 1) * ISOLATED_ARC.spacing;
  const available = bounds ? (bounds.x2 - bounds.x1) * 0.8 : natural;
  const width = Math.min(natural, Math.max(available, 0));
  const cx = bounds ? (bounds.x1 + bounds.x2) / 2 : 0;
  const baseY = bounds ? bounds.y2 + ISOLATED_ARC.gap : 0;
  const sag = width * ISOLATED_ARC.sagRatio;
  return new Map(
    sorted.map((id, i) => {
      // t de -1 a 1 ; l'arc s'abaisse vers le centre (bord bas d'une voute).
      const t = count === 1 ? 0 : (2 * i) / (count - 1) - 1;
      return [id, { x: cx + (t * width) / 2, y: baseY + sag * (1 - t * t) }];
    }),
  );
}

export type ViewExtent = { x1: number; y1: number; x2: number; y2: number };

// Zone visible du cadrage (coordonnees du modele, cy.extent()) : une etoile
// placee automatiquement n'en sort jamais (KAN-87, retour de recette). Elle
// est ramenee a l'interieur, en retrait de `insetRatio` de chaque bord pour
// ne pas coller au cadre.
export function clampIntoView(
  position: NodePosition,
  extent: ViewExtent,
  insetRatio = 0.1,
): NodePosition {
  const insetX = (extent.x2 - extent.x1) * insetRatio;
  const insetY = (extent.y2 - extent.y1) * insetRatio;
  return {
    x: Math.min(Math.max(position.x, extent.x1 + insetX), extent.x2 - insetX),
    y: Math.min(Math.max(position.y, extent.y1 + insetY), extent.y2 - insetY),
  };
}

// Ecart minimal entre deux etoiles placees automatiquement (unites du
// modele), au-dela du diametre d'un astre et de sa lueur.
export const MIN_STAR_GAP = 60;
// Anneaux de recherche d'une place libre (rayon = n x MIN_STAR_GAP).
const SEPARATION_RINGS = 12;

// Une nouvelle etoile ne se pose jamais SUR une autre (BUG-019) : fcose, avec
// les etoiles connues figees, pose une etoile sans lien a un point fixe, meme
// occupe - l'etoile du dessous devenait invisible et impossible a cliquer.
// Position deja libre : rendue telle quelle. Sinon, la place libre la plus
// proche sur des anneaux successifs autour d'elle (8 x n points sur le n-ieme,
// ordre fixe : deterministe), DANS la zone de clampIntoView. Aucune place
// libre dans le champ : position inchangee.
export function separateFromStars(
  position: NodePosition,
  others: readonly NodePosition[],
  extent: ViewExtent,
  minGap = MIN_STAR_GAP,
  insetRatio = 0.1,
): NodePosition {
  const isFree = (candidate: NodePosition) =>
    others.every((other) => Math.hypot(other.x - candidate.x, other.y - candidate.y) >= minGap);
  if (isFree(position)) {
    return position;
  }
  const insetX = (extent.x2 - extent.x1) * insetRatio;
  const insetY = (extent.y2 - extent.y1) * insetRatio;
  const inView = (candidate: NodePosition) =>
    candidate.x >= extent.x1 + insetX &&
    candidate.x <= extent.x2 - insetX &&
    candidate.y >= extent.y1 + insetY &&
    candidate.y <= extent.y2 - insetY;
  for (let ring = 1; ring <= SEPARATION_RINGS; ring += 1) {
    const radius = ring * minGap;
    const steps = 8 * ring;
    for (let step = 0; step < steps; step += 1) {
      const angle = (2 * Math.PI * step) / steps;
      const candidate = {
        x: position.x + radius * Math.cos(angle),
        y: position.y + radius * Math.sin(angle),
      };
      if (inView(candidate) && isFree(candidate)) {
        return candidate;
      }
    }
  }
  return position;
}

// Cadrage « ajuster a l'ecran » (KAN-87, revu KAN-85) : la scene n'est
// amputee que des COINS reellement occupes (titre du monde en haut a gauche,
// pilules en haut a droite, controles en bas a droite, compteurs en bas a
// gauche, sidebar en verre quand elle est ouverte) - jamais d'une bande sur
// toute la largeur. Chaque coin peut etre evite par le cote ou par le
// haut/bas : toutes les combinaisons sont essayees et l'on garde le
// rectangle libre qui donne le plus grand zoom. Les etoiles y occupent
// FIT_OCCUPANCY de la largeur ou de la hauteur, centrees ; zoom borne
// (minZoom, et maxZoom : un petit monde ne s'affiche jamais en gros plan).
export type CornerSize = { width: number; height: number };
export type ReservedCorners = Partial<
  Record<"topLeft" | "topRight" | "bottomLeft" | "bottomRight", CornerSize>
>;
export type FreeRect = { x1: number; y1: number; x2: number; y2: number };
export const FIT_OCCUPANCY = 0.85;
const CORNERS = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;

// Rectangles libres candidats (un par combinaison d'evitement des coins).
export function freeRects(width: number, height: number, corners: ReservedCorners): FreeRect[] {
  const entries = CORNERS.flatMap((corner) => {
    const size = corners[corner];
    return size && size.width > 0 && size.height > 0 ? [[corner, size] as const] : [];
  });
  const rects: FreeRect[] = [];
  for (let mask = 0; mask < 2 ** entries.length; mask += 1) {
    let x1 = 0;
    let x2 = width;
    let y1 = 0;
    let y2 = height;
    entries.forEach(([corner, size], index) => {
      // Bit a 1 : coin evite par le cote ; a 0 : par le haut ou le bas.
      const sideways = (mask >> index) & 1;
      const left = corner === "topLeft" || corner === "bottomLeft";
      const top = corner === "topLeft" || corner === "topRight";
      if (sideways) {
        if (left) {
          x1 = Math.max(x1, size.width);
        } else {
          x2 = Math.min(x2, width - size.width);
        }
      } else if (top) {
        y1 = Math.max(y1, size.height);
      } else {
        y2 = Math.min(y2, height - size.height);
      }
    });
    if (x2 - x1 > 1 && y2 - y1 > 1) {
      rects.push({ x1, y1, x2, y2 });
    }
  }
  return rects.length > 0 ? rects : [{ x1: 0, y1: 0, x2: width, y2: height }];
}

export function fitViewport({
  bounds,
  width,
  height,
  corners = {},
  minZoom,
  maxZoom,
  occupancy = FIT_OCCUPANCY,
}: {
  bounds: ViewExtent;
  width: number;
  height: number;
  corners?: ReservedCorners;
  minZoom: number;
  maxZoom: number;
  occupancy?: number;
}): { zoom: number; pan: NodePosition; rect: FreeRect } {
  const graphWidth = Math.max(bounds.x2 - bounds.x1, 1);
  const graphHeight = Math.max(bounds.y2 - bounds.y1, 1);
  let best: { zoom: number; rect: FreeRect } | null = null;
  for (const rect of freeRects(width, height, corners)) {
    const fitted =
      Math.min((rect.x2 - rect.x1) / graphWidth, (rect.y2 - rect.y1) / graphHeight) * occupancy;
    const zoom = Math.min(maxZoom, Math.max(minZoom, fitted));
    if (!best || zoom > best.zoom + 1e-9) {
      best = { zoom, rect };
    }
  }
  const { zoom, rect } = best ?? { zoom: minZoom, rect: { x1: 0, y1: 0, x2: width, y2: height } };
  const centerX = (bounds.x1 + bounds.x2) / 2;
  const centerY = (bounds.y1 + bounds.y2) / 2;
  return {
    zoom,
    rect,
    pan: {
      x: (rect.x1 + rect.x2) / 2 - centerX * zoom,
      y: (rect.y1 + rect.y2) / 2 - centerY * zoom,
    },
  };
}

// Plus grand rectangle libre (aire) : proportions de la scene pour le
// rangement des constellations.
export function largestFreeRect(width: number, height: number, corners: ReservedCorners): FreeRect {
  return freeRects(width, height, corners).reduce((best, rect) =>
    (rect.x2 - rect.x1) * (rect.y2 - rect.y1) > (best.x2 - best.x1) * (best.y2 - best.y1)
      ? rect
      : best,
  );
}
