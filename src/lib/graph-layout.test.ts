import { describe, expect, it } from "vitest";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import { clampIntoView, fcoseOptions, fitViewport, planPlacement } from "./graph-layout";

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

describe("fitViewport", () => {
  const base = { width: 1000, height: 800, padding: 50, minZoom: 0.1, maxZoom: 4 };

  it("sans reserve : le graphe remplit la zone, centre", () => {
    const view = fitViewport({ ...base, bounds: { x1: 0, y1: 0, x2: 900, y2: 700 }, topInset: 0 });

    expect(view.zoom).toBe(1);
    expect(view.pan).toEqual({ x: 50, y: 50 });
  });

  it("bande haute reservee : aucune etoile au-dessus de la reserve", () => {
    const bounds = { x1: 0, y1: 0, x2: 900, y2: 700 };
    const view = fitViewport({ ...base, bounds, topInset: 140 });

    const topOnScreen = bounds.y1 * view.zoom + view.pan.y;
    expect(topOnScreen).toBeGreaterThanOrEqual(140);
    expect(view.zoom).toBeLessThan(1);
  });

  it("recul d'un cran et plafond de zoom", () => {
    const small = { x1: 0, y1: 0, x2: 100, y2: 100 };

    expect(fitViewport({ ...base, bounds: small, topInset: 0, maxZoom: 1.2 }).zoom).toBe(1.2);
    expect(
      fitViewport({
        ...base,
        bounds: { x1: 0, y1: 0, x2: 900, y2: 700 },
        topInset: 0,
        zoomFactor: 0.8,
      }).zoom,
    ).toBeCloseTo(0.8);
  });

  it("graphe d'une seule etoile (boite nulle) : zoom borne, centre dans la zone utile", () => {
    const view = fitViewport({
      ...base,
      bounds: { x1: 10, y1: 10, x2: 10, y2: 10 },
      topInset: 100,
      maxZoom: 1.2,
    });

    expect(view.zoom).toBe(1.2);
    expect(10 * view.zoom + view.pan.y).toBeCloseTo(100 + 700 / 2);
  });

  it("zoom minimal respecte pour un tres grand graphe", () => {
    expect(
      fitViewport({ ...base, bounds: { x1: 0, y1: 0, x2: 1e6, y2: 1e6 }, topInset: 0 }).zoom,
    ).toBe(0.1);
  });
});
