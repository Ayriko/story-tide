import { describe, expect, it } from "vitest";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import {
  clampIntoView,
  MIN_STAR_GAP,
  separateFromStars,
  fcoseOptions,
  FIT_OCCUPANCY,
  fitViewport,
  freeRects,
  largestFreeRect,
  communityLayoutOptions,
  communitySpacing,
  ISOLATED_ARC,
  isolatedArcPositions,
  LARGE_WORLD_ENTRIES,
  BLOCK_TRANSFORMS,
  orientBlocks,
  PACK_MARGIN,
  packCommunities,
  refineLayoutOptions,
  planPlacement,
  type CommunityBlock,
  type CommunityLink,
} from "./graph-layout";

cytoscape.use(fcose);

describe("planPlacement", () => {
  it("toutes les etoiles ont une place : preset, rien de nouveau", () => {
    const plan = planPlacement(
      ["a", "b"],
      new Map([
        ["a", { x: 1, y: 2 }],
        ["b", { x: 3, y: 4 }],
      ]),
    );

    expect(plan.mode).toBe("preset");
    expect(plan.newNodeIds).toEqual([]);
    expect(plan.fixed).toEqual([
      { nodeId: "a", position: { x: 1, y: 2 } },
      { nodeId: "b", position: { x: 3, y: 4 } },
    ]);
  });

  it("aucune place connue (premier passage) : mise en page complete", () => {
    const plan = planPlacement(["a", "b"], new Map());

    expect(plan.mode).toBe("full");
    expect(plan.fixed).toEqual([]);
    expect(plan.newNodeIds).toEqual(["a", "b"]);
  });

  it("melange : les connues sont fixees, seules les nouvelles sont a placer", () => {
    const plan = planPlacement(["a", "nouvelle", "b"], new Map([["a", { x: 10, y: -5 }]]));

    expect(plan.mode).toBe("incremental");
    expect(plan.fixed).toEqual([{ nodeId: "a", position: { x: 10, y: -5 } }]);
    expect(plan.newNodeIds).toEqual(["nouvelle", "b"]);
  });

  it("place d'une entree disparue : ignoree", () => {
    const plan = planPlacement(["a"], new Map([["supprimee", { x: 0, y: 0 }]]));

    expect(plan.mode).toBe("full");
    expect(plan.fixed).toEqual([]);
  });

  it("graphe vide : preset, rien a faire", () => {
    expect(planPlacement([], new Map()).mode).toBe("preset");
  });
});

describe("fcoseOptions", () => {
  it("incremental : contraintes de position fixe sur les seules etoiles connues", () => {
    const plan = planPlacement(["a", "b"], new Map([["a", { x: 1, y: 1 }]]));

    expect(fcoseOptions(plan)).toMatchObject({
      name: "fcose",
      animate: false,
      fit: false,
      fixedNodeConstraint: [{ nodeId: "a", position: { x: 1, y: 1 } }],
    });
  });

  it("complet : aucune contrainte", () => {
    expect(fcoseOptions(planPlacement(["a"], new Map())).fixedNodeConstraint).toBeUndefined();
  });

  it("grand monde (KAN-85) : mise en page plus aeree au-dela du seuil", () => {
    const plan = planPlacement(["a"], new Map());
    const small = fcoseOptions(plan, LARGE_WORLD_ENTRIES);
    const large = fcoseOptions(plan, LARGE_WORLD_ENTRIES + 1);
    expect(small.nodeSeparation).toBe(120);
    expect(small.idealEdgeLength()).toBe(120);
    expect(large.nodeSeparation).toBeGreaterThan(small.nodeSeparation);
    expect(large.idealEdgeLength()).toBeGreaterThan(small.idealEdgeLength());
    expect(large.nodeRepulsion()).toBeGreaterThan(small.nodeRepulsion());
    expect(large.gravity).toBeLessThan(small.gravity);
  });

  // Preuve de bout en bout avec le vrai fcose (instance headless) : les
  // etoiles connues ne bougent pas, la nouvelle recoit une place.
  it("fcose reel : aucune etoile fixee deplacee, la nouvelle est placee", () => {
    const known = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 300, y: 0 }],
      ["c", { x: 150, y: 250 }],
    ]);
    const cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: [
        ...[...known].map(([id, position]) => ({ data: { id }, position: { ...position } })),
        { data: { id: "nouvelle" } },
        { data: { id: "ab", source: "a", target: "b" } },
        { data: { id: "an", source: "a", target: "nouvelle" } },
      ],
    });
    const plan = planPlacement(
      cy.nodes().map((node) => node.id()),
      known,
    );

    cy.layout(fcoseOptions(plan)).run();

    for (const [id, position] of known) {
      expect(cy.getElementById(id).position("x")).toBeCloseTo(position.x, 3);
      expect(cy.getElementById(id).position("y")).toBeCloseTo(position.y, 3);
    }
    const placed = cy.getElementById("nouvelle").position();
    expect(Number.isFinite(placed.x) && Number.isFinite(placed.y)).toBe(true);
    cy.destroy();
  });
});

describe("clampIntoView", () => {
  const extent = { x1: 0, y1: 0, x2: 1000, y2: 500 };

  it("position deja dans la zone : inchangee", () => {
    expect(clampIntoView({ x: 400, y: 200 }, extent)).toEqual({ x: 400, y: 200 });
  });

  it("position hors champ : ramenee dans la zone, en retrait des bords", () => {
    expect(clampIntoView({ x: 5000, y: -300 }, extent)).toEqual({ x: 900, y: 50 });
    expect(clampIntoView({ x: -10, y: 9999 }, extent)).toEqual({ x: 100, y: 450 });
  });

  it("retrait personnalise", () => {
    expect(clampIntoView({ x: 2000, y: 250 }, extent, 0)).toEqual({ x: 1000, y: 250 });
  });
});

describe("separateFromStars (BUG-019)", () => {
  const extent = { x1: -500, y1: -500, x2: 500, y2: 500 };
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it("place deja libre : position inchangee", () => {
    const position = { x: 200, y: 0 };
    expect(separateFromStars(position, [{ x: 0, y: 0 }], extent)).toBe(position);
  });

  it("posee sur une autre etoile : deplacee a l'ecart, dans le champ", () => {
    const others = [
      { x: 128, y: 72 },
      { x: 0, y: 0 },
    ];
    const moved = separateFromStars({ x: 128, y: 72 }, others, extent);
    others.forEach((other) => expect(distance(moved, other)).toBeGreaterThanOrEqual(MIN_STAR_GAP));
    expect(clampIntoView(moved, extent)).toEqual(moved);
    // Place libre la plus proche : premier anneau.
    expect(distance(moved, { x: 128, y: 72 })).toBeCloseTo(MIN_STAR_GAP, 6);
  });

  it("deterministe : meme entree, meme place", () => {
    const others = [{ x: 10, y: 10 }];
    expect(separateFromStars({ x: 10, y: 10 }, others, extent)).toEqual(
      separateFromStars({ x: 10, y: 10 }, others, extent),
    );
  });

  it("premier anneau plein : cherche plus loin", () => {
    const center = { x: 0, y: 0 };
    const ring = Array.from({ length: 8 }, (_, step) => ({
      x: MIN_STAR_GAP * Math.cos((2 * Math.PI * step) / 8),
      y: MIN_STAR_GAP * Math.sin((2 * Math.PI * step) / 8),
    }));
    const others = [center, ...ring];
    const moved = separateFromStars(center, others, extent);
    others.forEach((other) => expect(distance(moved, other)).toBeGreaterThanOrEqual(MIN_STAR_GAP));
    expect(distance(moved, center)).toBeGreaterThan(MIN_STAR_GAP);
  });

  it("au bord du champ : la place choisie reste dans la zone", () => {
    const edge = { x: 400, y: 400 };
    const moved = separateFromStars(edge, [edge], extent);
    expect(clampIntoView(moved, extent)).toEqual(moved);
    expect(distance(moved, edge)).toBeGreaterThanOrEqual(MIN_STAR_GAP);
  });

  it("aucune place libre dans le champ : position inchangee", () => {
    const tiny = { x1: 0, y1: 0, x2: 10, y2: 10 };
    const position = { x: 5, y: 5 };
    expect(separateFromStars(position, [position], tiny)).toBe(position);
  });
});

describe("communitySpacing (KAN-85)", () => {
  it("croit avec la racine du nombre d'etoiles : une grande figure respire", () => {
    expect(communitySpacing(4)).toBeLessThan(communitySpacing(16));
    expect(communitySpacing(16)).toBeLessThan(communitySpacing(64));
    // Racine : quadrupler la taille ne double meme pas l'espacement.
    expect(communitySpacing(64) / communitySpacing(16)).toBeLessThan(2);
    expect(communitySpacing(0)).toBe(communitySpacing(1));
    const options = communityLayoutOptions(false, 60);
    expect(options.idealEdgeLength()).toBe(communitySpacing(60));
    expect(
      refineLayoutOptions(new Map(), [], false, 60).idealEdgeLength({
        source: () => ({ id: () => "a" }),
        target: () => ({ id: () => "a" }),
      }),
    ).toBe(communitySpacing(60));
  });
});

describe("communityLayoutOptions (KAN-85)", () => {
  it("constellation compacte, libelles compris dans la taille des etoiles", () => {
    const options = communityLayoutOptions();
    expect(options).toMatchObject({ name: "fcose", animate: false, fit: false });
    expect(options.nodeDimensionsIncludeLabels).toBe(true);
    expect(options.idealEdgeLength()).toBeLessThan(
      fcoseOptions(planPlacement(["a"], new Map()), 3).idealEdgeLength(),
    );
  });
});

type Box = { x1: number; y1: number; x2: number; y2: number };
function boxes(
  blocks: CommunityBlock[],
  centers: Map<string, { x: number; y: number }>,
): Map<string, Box> {
  return new Map(
    blocks.map((block) => {
      const c = centers.get(block.id) ?? { x: NaN, y: NaN };
      return [
        block.id,
        {
          x1: c.x - block.width / 2,
          y1: c.y - block.height / 2,
          x2: c.x + block.width / 2,
          y2: c.y + block.height / 2,
        },
      ];
    }),
  );
}
const gapBetween = (p: Box, q: Box) => Math.max(q.x1 - p.x2, p.x1 - q.x2, q.y1 - p.y2, p.y1 - q.y2);

describe("packCommunities", () => {
  const BLOCKS: CommunityBlock[] = [
    { id: "petit", width: 100, height: 80 },
    { id: "grand", width: 600, height: 400 },
    { id: "moyen", width: 300, height: 250 },
    { id: "bavard", width: 250, height: 200 },
    { id: "lointain", width: 200, height: 220 },
  ];
  const LINKS: CommunityLink[] = [
    { a: "grand", b: "bavard", weight: 9 },
    { a: "bavard", b: "petit", weight: 1 },
  ];

  it("aucun chevauchement : marge reguliere entre tous les blocs", () => {
    const placed = boxes(BLOCKS, packCommunities(BLOCKS, LINKS, 16 / 9, 120));
    const all = [...placed.values()];
    all.forEach((p, i) =>
      all.slice(i + 1).forEach((q) => expect(gapBetween(p, q)).toBeGreaterThanOrEqual(120 - 1e-9)),
    );
  });

  it("la plus grande communaute au centre de sa rangee, quand les liens ne s'y opposent pas", () => {
    const centers = packCommunities(BLOCKS, [], 16 / 9);
    const grand = centers.get("grand");
    const sameRow = BLOCKS.filter((block) => centers.get(block.id)?.y === grand?.y);
    expect(sameRow.length).toBeGreaterThan(1);
    for (const block of sameRow) {
      expect(Math.abs(grand?.x ?? Infinity)).toBeLessThanOrEqual(
        Math.abs(centers.get(block.id)?.x ?? 0),
      );
    }
  });

  it("celles qui se parlent le plus sont cote a cote", () => {
    const centers = packCommunities(BLOCKS, LINKS, 16 / 9);
    const placed = boxes(BLOCKS, centers);
    const grand = placed.get("grand");
    const bavard = placed.get("bavard");
    if (!grand || !bavard) {
      throw new Error("bloc absent");
    }
    // Voisins directs : separes par la seule marge.
    expect(gapBetween(grand, bavard)).toBeCloseTo(PACK_MARGIN, 6);
  });

  it("proportions de la scene : plusieurs rangees, plus large que haut en 16:9", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, width: 300, height: 300 }));
    const placed = [...boxes(many, packCommunities(many, [], 16 / 9)).values()];
    const width = Math.max(...placed.map((b) => b.x2)) - Math.min(...placed.map((b) => b.x1));
    const height = Math.max(...placed.map((b) => b.y2)) - Math.min(...placed.map((b) => b.y1));
    expect(height).toBeGreaterThan(300);
    expect(width / height).toBeGreaterThan(1.2);
    expect(width / height).toBeLessThan(3);
  });

  it("remplit la scene : zoom « ajuster » maximal, a egalite le moins de rangees", () => {
    const two = [
      { id: "a", width: 100, height: 100 },
      { id: "b", width: 100, height: 100 },
    ];
    // Scene tres large : une seule rangee.
    const wide = packCommunities(two, [], 10, 20);
    expect(wide.get("a")?.y).toBe(wide.get("b")?.y);
    // Scene tres haute : une colonne.
    const tall = packCommunities(two, [], 0.1, 20);
    expect(tall.get("a")?.x).toBe(tall.get("b")?.x);
  });

  it("deterministe, quel que soit l'ordre des donnees ; vide : rien", () => {
    const forward = packCommunities(BLOCKS, LINKS, 16 / 9);
    const backward = packCommunities([...BLOCKS].reverse(), [...LINKS].reverse(), 16 / 9);
    expect([...backward].sort()).toEqual([...forward].sort());
    expect(packCommunities([], [], 16 / 9).size).toBe(0);
    expect(
      packCommunities([{ id: "seul", width: 10, height: 10 }], [], 16 / 9).get("seul"),
    ).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("isolatedArcPositions", () => {
  const bounds = { x1: 0, y1: 0, x2: 2000, y2: 1000 };

  it("sous les constellations, sur un arc qui s'abaisse vers le centre", () => {
    const arc = isolatedArcPositions(["c", "a", "b"], bounds);
    const [a, b, c] = ["a", "b", "c"].map((id) => arc.get(id));
    expect(a?.x).toBeLessThan(b?.x ?? 0);
    expect(b?.x).toBeLessThan(c?.x ?? 0);
    expect(b?.x).toBe(1000);
    for (const point of [a, b, c]) {
      expect(point?.y).toBeGreaterThanOrEqual(1000 + ISOLATED_ARC.gap);
    }
    expect(b?.y).toBeGreaterThan(a?.y ?? Infinity);
    expect(a?.y).toBeCloseTo(c?.y ?? 0, 6);
  });

  it("espacement regulier, jamais plus large que 80 % du ciel", () => {
    const many = isolatedArcPositions(
      Array.from({ length: 100 }, (_, i) => `n${String(i).padStart(3, "0")}`),
      bounds,
    );
    const xs = [...many.values()].map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1600, 6);
    const few = isolatedArcPositions(["a", "b"], bounds);
    expect(Math.abs((few.get("b")?.x ?? 0) - (few.get("a")?.x ?? 0))).toBe(ISOLATED_ARC.spacing);
  });

  it("aucune constellation (monde sans lien) : arc centre sur l'origine ; aucune etoile : vide", () => {
    const arc = isolatedArcPositions(["a", "b", "c"], null);
    expect(arc.get("b")?.x).toBe(0);
    expect(isolatedArcPositions([], bounds).size).toBe(0);
  });
});

describe("fitViewport", () => {
  const base = { width: 1000, height: 800, minZoom: 0.1, maxZoom: 4 };
  const bounds = { x1: 0, y1: 0, x2: 1000, y2: 800 };
  const onScreen = (
    view: { zoom: number; pan: { x: number; y: number } },
    x: number,
    y: number,
  ) => ({
    x: x * view.zoom + view.pan.x,
    y: y * view.zoom + view.pan.y,
  });

  it("sans coin reserve : les etoiles occupent 85 % de la scene, centrees", () => {
    const view = fitViewport({ ...base, bounds });
    expect(view.zoom).toBeCloseTo(FIT_OCCUPANCY, 6);
    expect(onScreen(view, 500, 400)).toEqual({ x: 500, y: 400 });
  });

  it("seuls les coins sont reserves, jamais une bande sur toute la largeur", () => {
    // Titre en haut a gauche (300 x 120), controles en bas a droite (80 x 260),
    // graphe haut (500 x 800).
    const tall = { x1: 0, y1: 0, x2: 500, y2: 800 };
    const corners = {
      topLeft: { width: 300, height: 120 },
      bottomRight: { width: 80, height: 260 },
    };
    const view = fitViewport({ ...base, bounds: tall, corners });
    // Deux bandes pleine largeur ne laisseraient que 420 px de haut.
    expect(view.zoom).toBeGreaterThan((420 / 800) * FIT_OCCUPANCY);
    expect(view.zoom).toBeCloseTo(FIT_OCCUPANCY, 6);
    // Aucune etoile sous un coin reserve.
    const topLeft = onScreen(view, 0, 0);
    const bottomRight = onScreen(view, 500, 800);
    expect(topLeft.x >= 300 || topLeft.y >= 120).toBe(true);
    expect(bottomRight.x <= 920 || bottomRight.y <= 540).toBe(true);
  });

  it("garde le rectangle libre qui donne le plus grand zoom", () => {
    // Graphe tres large : mieux vaut passer SOUS le titre (pleine largeur)
    // qu'a sa droite.
    const wide = { x1: 0, y1: 0, x2: 2000, y2: 200 };
    const view = fitViewport({
      ...base,
      bounds: wide,
      corners: { topLeft: { width: 400, height: 100 } },
    });
    expect(view.rect).toEqual({ x1: 0, y1: 100, x2: 1000, y2: 800 });
    // Graphe tres haut : a droite du titre (pleine hauteur).
    const tall = { x1: 0, y1: 0, x2: 200, y2: 2000 };
    const view2 = fitViewport({
      ...base,
      bounds: tall,
      corners: { topLeft: { width: 400, height: 100 } },
    });
    expect(view2.rect).toEqual({ x1: 400, y1: 0, x2: 1000, y2: 800 });
  });

  it("plafond et plancher de zoom ; etoile unique centree dans le rectangle libre", () => {
    const one = { x1: 10, y1: 10, x2: 10, y2: 10 };
    const view = fitViewport({
      ...base,
      bounds: one,
      maxZoom: 1.2,
      corners: { topLeft: { width: 1000, height: 100 } },
    });
    expect(view.zoom).toBe(1.2);
    expect(onScreen(view, 10, 10)).toEqual({ x: 500, y: 450 });
    expect(fitViewport({ ...base, bounds: { x1: 0, y1: 0, x2: 1e6, y2: 1e6 } }).zoom).toBe(0.1);
  });

  it("coins qui couvrent tout : repli sur la scene entiere", () => {
    const rects = freeRects(100, 100, {
      topLeft: { width: 100, height: 100 },
      bottomRight: { width: 100, height: 100 },
    });
    expect(rects).toEqual([{ x1: 0, y1: 0, x2: 100, y2: 100 }]);
  });

  it("plus grand rectangle libre (proportions du rangement)", () => {
    expect(largestFreeRect(1000, 800, { topLeft: { width: 300, height: 120 } })).toEqual({
      x1: 0,
      y1: 120,
      x2: 1000,
      y2: 800,
    });
  });
});

describe("packCommunities - voisinage par affinite (KAN-85)", () => {
  it("deux blocs fortement relies ne sont jamais separes par un troisieme", () => {
    // Ordre de rangement : grand, puis gauche (lie au grand), puis droite
    // (lie surtout a gauche) - droite doit rejoindre gauche, pas l'autre bout.
    const blocks: CommunityBlock[] = [
      { id: "grand", width: 300, height: 300 },
      { id: "gauche", width: 200, height: 200 },
      { id: "droite", width: 200, height: 200 },
    ];
    const links: CommunityLink[] = [
      { a: "grand", b: "gauche", weight: 3 },
      { a: "gauche", b: "droite", weight: 8 },
    ];
    const centers = packCommunities(blocks, links, 10, 20);
    const xs = ["grand", "gauche", "droite"].map((id) => centers.get(id)?.x ?? 0);
    const [grand, gauche, droite] = xs as [number, number, number];
    // gauche entre grand et droite : droite colle a gauche.
    expect(Math.min(grand, droite) < gauche && gauche < Math.max(grand, droite)).toBe(true);
  });
});

describe("orientBlocks", () => {
  const block = (id: string, members: [string, number, number][]) => ({
    id,
    width: 200,
    height: 200,
    members: new Map(members.map(([m, x, y]) => [m, { x, y }])),
  });

  it("tourne un bloc pour rapprocher ses ponts du bloc deja place", () => {
    // Bloc place a gauche (plus grand, oriente le premier) ; « v » est au bord
    // GAUCHE de son bloc, ses ponts vont vers la gauche... mais le bloc est a
    // droite : apres orientation, v doit faire face au bloc de gauche.
    const left = block("gauche", [
      ["l1", 0, 0],
      ["l2", 50, 0],
    ]);
    const leftBig = { ...left, width: 400, height: 400 };
    const right = block("droite", [
      ["v", -90, 0],
      ["r2", 90, 0],
    ]);
    const centers = new Map([
      ["gauche", { x: -300, y: 0 }],
      ["droite", { x: 300, y: 0 }],
    ]);
    const placed = orientBlocks([leftBig, right], centers, [
      { a: "v", b: "l1", weight: 1 },
      { a: "v", b: "l2", weight: 1 },
    ]);
    expect(placed.get("v")?.x).toBe(210);
    expect(placed.get("r2")?.x).toBe(390);
    // Le bloc reste a sa place (centre inchange), sans deformation.
    expect(Math.abs((placed.get("r2")?.x ?? 0) - (placed.get("v")?.x ?? 0))).toBe(180);
  });

  it("sans ponts : orientation d'origine ; quart de tour refuse si le bloc ne tient plus", () => {
    const tall = { ...block("haut", [["t", 0, -100]]), width: 100, height: 400 };
    const other = { ...block("autre", [["o", 0, 0]]), width: 500, height: 500 };
    const centers = new Map([
      ["haut", { x: 0, y: 0 }],
      ["autre", { x: 600, y: 0 }],
    ]);
    // Seul un quart de tour rapprocherait « t » de « o » : interdit.
    const placed = orientBlocks([tall, other], centers, [{ a: "t", b: "o", weight: 1 }], 40);
    expect(placed.get("t")?.x).toBe(0);
    expect(Math.abs(placed.get("t")?.y ?? 0)).toBe(100);
    const alone = orientBlocks([other], new Map([["autre", { x: 5, y: 5 }]]), []);
    expect(alone.get("o")).toEqual({ x: 5, y: 5 });
  });

  it("les 8 orientations conservent les distances (ni etirement ni ecrasement)", () => {
    for (const t of BLOCK_TRANSFORMS) {
      expect(Math.abs(t.xx * t.yy - t.xy * t.yx)).toBe(1);
      expect(t.xx * t.xx + t.yx * t.yx).toBe(1);
    }
    expect(new Set(BLOCK_TRANSFORMS.map((t) => JSON.stringify(t))).size).toBe(8);
  });
});

describe("refineLayoutOptions", () => {
  const communities = new Map([
    ["a", "a"],
    ["b", "a"],
    ["c", "c"],
  ]);
  const edge = (s: string, t: string) => ({
    source: () => ({ id: () => s }),
    target: () => ({ id: () => t }),
  });

  it("aucun nouveau tirage, ponts faibles, etoiles du bout des ponts figees", () => {
    const options = refineLayoutOptions(communities, [{ nodeId: "c", position: { x: 1, y: 2 } }]);
    expect(options.randomize).toBe(false);
    expect(options.edgeElasticity(edge("a", "c"))).toBeLessThan(
      options.edgeElasticity(edge("a", "b")),
    );
    expect(options.fixedNodeConstraint).toEqual([{ nodeId: "c", position: { x: 1, y: 2 } }]);
    expect(refineLayoutOptions(communities).fixedNodeConstraint).toBeUndefined();
  });
});
