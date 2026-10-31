import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import cytoscape, { type Core, type NodeSingular } from "cytoscape";
import fcose from "cytoscape-fcose";
import { ENTITY_TYPE_REFERENCE } from "./entity-schemas";
import { buildGraphElements, type GraphElements } from "./graph-elements";
import { generatePerfWorld } from "./perf-world-generator";
import { mulberry32 } from "./prng";
import { RELATION_TYPE_REFERENCE } from "./relation-types";
import { arrangeSky, isSkyStar, skyCommunities } from "./sky-arrange";

// Disposition complete avec le VRAI fcose (instance headless). fcose tire au
// hasard (Math.random) : la graine est fixee pour un test reproductible.
cytoscape.use(fcose);

type Box = { x1: number; y1: number; x2: number; y2: number };

beforeEach(() => {
  vi.spyOn(Math, "random").mockImplementation(mulberry32(7));
});
afterEach(() => {
  vi.restoreAllMocks();
});

function sky(elements: GraphElements): Core {
  return cytoscape({
    headless: true,
    styleEnabled: true,
    elements: [...elements.nodes, ...elements.edges],
    style: [{ selector: "node", style: { width: 12, height: 12 } }],
  });
}

function entity(id: string) {
  return {
    id,
    name: id,
    typeKey: "character",
    typeLabel: "Personnage",
    group: "Personnages",
    icon: "user",
  };
}

const ALLY = {
  key: "ally",
  label: "Allié",
  inverseLabel: null,
  symmetric: true,
  isCustom: false,
  isHidden: false,
};

function communityBoxes(cy: Core): Map<string, Box> {
  const communities = skyCommunities(cy);
  const boxes = new Map<string, Box>();
  for (const community of new Set(communities.values())) {
    const nodes = cy
      .nodes()
      .filter((node) => isSkyStar(node) && communities.get(node.id()) === community)
      .nodes();
    if (nodes.length > 1) {
      boxes.set(community, nodes.boundingBox({ includeLabels: false }));
    }
  }
  return boxes;
}

const center = (box: Box) => ({ x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 });

// Position d'une etoile dans son bloc, projetee vers le bloc vise : 1 = bord
// tourne vers lui, -1 = bord oppose.
function facing(star: NodeSingular, own: Box, target: Box): number {
  const from = center(own);
  const to = center(target);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const half =
    ((Math.abs(dx) / length) * (own.x2 - own.x1)) / 2 +
    ((Math.abs(dy) / length) * (own.y2 - own.y1)) / 2;
  const p = star.position();
  return ((p.x - from.x) * dx + (p.y - from.y) * dy) / length / half;
}

function crosses(p: { x: number; y: number }, q: { x: number; y: number }, box: Box): boolean {
  for (let t = 0.05; t < 0.95; t += 0.01) {
    const x = p.x + (q.x - p.x) * t;
    const y = p.y + (q.y - p.y) * t;
    if (x > box.x1 && x < box.x2 && y > box.y1 && y < box.y2) {
      return true;
    }
  }
  return false;
}

describe("arrangeSky - cas « Viwen »", () => {
  // Trois constellations ; « viwen » appartient a A (trois relations
  // declarees, poids 6) mais a quatre liens du texte vers B (poids 4). C ne
  // parle qu'a A.
  const clique = (ids: string[]) =>
    ids.flatMap((a, i) =>
      ids.slice(i + 1).map((b) => ({ sourceId: a, targetId: b, relationType: ALLY })),
    );
  const A = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"];
  const B = ["b1", "b2", "b3", "b4", "b5", "b6", "b7"];
  const C = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];
  const elements = buildGraphElements(
    [...A, ...B, ...C, "viwen"].map(entity),
    [
      ...["b1", "b2", "b3", "b4"].map((b) => ({
        sourceId: "viwen",
        targetId: b,
        origin: "AUTO" as const,
      })),
      { sourceId: "a5", targetId: "b5", origin: "AUTO" as const },
      { sourceId: "c1", targetId: "a1", origin: "AUTO" as const },
    ],
    [
      ...clique(A),
      ...clique(B),
      ...clique(C),
      { sourceId: "viwen", targetId: "a1", relationType: ALLY },
      { sourceId: "viwen", targetId: "a2", relationType: ALLY },
      { sourceId: "viwen", targetId: "a3", relationType: ALLY },
    ],
  );

  it("viwen reste dans sa constellation, sur le bord tourne vers celle de ses ponts", () => {
    const cy = sky(elements);
    arrangeSky(cy, 16 / 9);
    const communities = skyCommunities(cy);
    expect(communities.get("viwen")).toBe(communities.get("a1"));
    const boxes = communityBoxes(cy);
    const own = boxes.get(communities.get("a1") ?? "");
    const target = boxes.get(communities.get("b1") ?? "");
    if (!own || !target) {
      throw new Error("constellations absentes");
    }
    expect(
      facing(cy.getElementById("viwen").nodes()[0] as NodeSingular, own, target),
    ).toBeGreaterThan(0.3);
    cy.destroy();
  });

  it("ses lignes ne traversent aucune autre constellation", () => {
    const cy = sky(elements);
    arrangeSky(cy, 16 / 9);
    const communities = skyCommunities(cy);
    const third = communityBoxes(cy).get(communities.get("c1") ?? "");
    if (!third) {
      throw new Error("constellation C absente");
    }
    const viwen = cy.getElementById("viwen").position();
    for (const b of ["b1", "b2", "b3", "b4"]) {
      expect(crosses(viwen, cy.getElementById(b).position(), third)).toBe(false);
    }
    cy.destroy();
  });
});

// Vraie mise en page de 300 etoiles (deux fois pour le determinisme) : ~1 s
// par disposition, plusieurs sous l'instrumentation de couverture - delai
// explicite, sans rien retirer de ce qui est verifie.
describe("arrangeSky - monde de test de 300", { timeout: 30_000 }, () => {
  const plan = generatePerfWorld();
  const ids = plan.entities.map((e) => e.ref);
  const elements = buildGraphElements(
    plan.entities.map((e) => ({
      id: e.ref,
      name: e.name,
      typeKey: e.type,
      typeLabel: ENTITY_TYPE_REFERENCE[e.type].label,
      group: e.group,
      icon: "user",
    })),
    plan.textLinks.map((l) => ({
      sourceId: ids[l.source] ?? "",
      targetId: ids[l.target] ?? "",
      origin: l.origin,
    })),
    plan.declared.map((d) => ({
      sourceId: ids[d.source] ?? "",
      targetId: ids[d.target] ?? "",
      relationType: {
        key: d.type,
        label: RELATION_TYPE_REFERENCE[d.type].label,
        inverseLabel: RELATION_TYPE_REFERENCE[d.type].inverseLabel,
        symmetric: RELATION_TYPE_REFERENCE[d.type].inverseLabel === null,
        isCustom: false,
        isHidden: false,
      },
    })),
  );

  it("les etoiles a plusieurs ponts vers un meme bloc sont tournees vers lui", () => {
    const cy = sky(elements);
    arrangeSky(cy, 1760 / 770);
    const communities = skyCommunities(cy);
    const boxes = communityBoxes(cy);
    const scores: number[] = [];
    cy.nodes()
      .filter(isSkyStar)
      .nodes()
      .forEach((star) => {
        const mine = communities.get(star.id()) ?? "";
        const outside = star
          .neighborhood()
          .nodes()
          .filter((n) => communities.get(n.id()) !== mine);
        const targets = new Set(outside.map((n) => communities.get(n.id())));
        const own = boxes.get(mine);
        const target = boxes.get([...targets][0] ?? "");
        if (outside.length >= 2 && targets.size === 1 && own && target) {
          scores.push(facing(star, own, target));
        }
      });
    expect(scores.length).toBeGreaterThan(5);
    expect(scores.filter((s) => s > 0).length / scores.length).toBeGreaterThanOrEqual(0.9);
    expect(scores.reduce((a, b) => a + b, 0) / scores.length).toBeGreaterThan(0.3);
    cy.destroy();
  });

  it("proportions de la scene, etoiles sans lien sur un arc sous le ciel", () => {
    const cy = sky(elements);
    arrangeSky(cy, 1760 / 770);
    const stars = cy.nodes().filter(isSkyStar).nodes();
    const lonely = stars.filter((n) => n.degree(false) === 0).nodes();
    const linked = stars.filter((n) => n.degree(false) > 0).nodes();
    const box = linked.boundingBox({ includeLabels: false });
    expect(box.w / box.h).toBeGreaterThan(1.2);
    expect(lonely.length).toBe(10);
    lonely.forEach((n) => expect(n.position("y")).toBeGreaterThan(box.y2));
    cy.destroy();
  });

  it("deterministe : meme graine, meme ciel", () => {
    const run = () => {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(7));
      const cy = sky(elements);
      arrangeSky(cy, 16 / 9);
      const positions = cy
        .nodes()
        .map((n) => [n.id(), Math.round(n.position("x")), Math.round(n.position("y"))]);
      cy.destroy();
      return positions;
    };
    expect(run()).toEqual(run());
  });
});
