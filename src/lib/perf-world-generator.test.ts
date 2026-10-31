import { describe, expect, it } from "vitest";
import { ENTITY_TYPE_GROUPS, ENTITY_TYPE_REFERENCE } from "./entity-schemas";
import {
  generatePerfWorld,
  PERF_COUNTS,
  perfEntityContent,
  type PerfWorldPlan,
} from "./perf-world-generator";
import { mulberry32 } from "./prng";

// Voisins distincts par entree, liens du texte et relations declarees
// confondus (ce que la Constellation dessine : une arete par paire).
function neighbourCounts(plan: PerfWorldPlan): number[] {
  const neighbours = plan.entities.map(() => new Set<number>());
  for (const link of [...plan.textLinks, ...plan.declared]) {
    neighbours[link.source]?.add(link.target);
    neighbours[link.target]?.add(link.source);
  }
  return neighbours.map((set) => set.size);
}

const plan = generatePerfWorld();

describe("mulberry32", () => {
  it("meme graine : meme suite, dans [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const values = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(values);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("generatePerfWorld", () => {
  it("est deterministe : meme graine, memes donnees", () => {
    expect(generatePerfWorld()).toEqual(plan);
  });

  it("une autre graine donne un autre monde", () => {
    expect(generatePerfWorld(1).entities.map((e) => e.name)).not.toEqual(
      plan.entities.map((e) => e.name),
    );
  });

  it("300 entrees aux noms et seedRef uniques, reparties sur les 8 groupes", () => {
    expect(plan.entities).toHaveLength(300);
    expect(new Set(plan.entities.map((e) => e.name)).size).toBe(300);
    expect(new Set(plan.entities.map((e) => e.ref)).size).toBe(300);
    for (const group of ENTITY_TYPE_GROUPS) {
      expect(plan.entities.filter((e) => e.group === group).length).toBeGreaterThanOrEqual(37);
    }
    for (const entity of plan.entities) {
      expect(ENTITY_TYPE_REFERENCE[entity.type].group).toBe(entity.group);
    }
  });

  it("nombres de liens du texte et de relations declarees attendus", () => {
    expect(plan.textLinks).toHaveLength(PERF_COUNTS.textLinks);
    expect(plan.declared).toHaveLength(PERF_COUNTS.declared);
    const manual = plan.textLinks.filter((l) => l.origin === "MANUAL").length;
    expect(manual).toBeGreaterThan(20);
    expect(manual).toBeLessThan(120);
  });

  it("aucune relation d'une entree vers elle-meme, index dans les bornes", () => {
    for (const link of [...plan.textLinks, ...plan.declared]) {
      expect(link.source).not.toBe(link.target);
      expect(link.source).toBeGreaterThanOrEqual(0);
      expect(link.target).toBeLessThan(300);
    }
  });

  it("aucun doublon qui violerait un unique (paires non ordonnees)", () => {
    const textKeys = plan.textLinks.map((l) =>
      [l.source, l.target].sort((a, b) => a - b).join("~"),
    );
    expect(new Set(textKeys).size).toBe(textKeys.length);
    const declaredKeys = plan.declared.map((d) =>
      [d.source, d.target].sort((a, b) => a - b).join("~"),
    );
    expect(new Set(declaredKeys).size).toBe(declaredKeys.length);
  });

  it("distribution realiste : 10 isolees, quelques astres de 10 a 30, majorite a 1-4", () => {
    const counts = neighbourCounts(plan);
    expect(counts.filter((c) => c === 0)).toHaveLength(PERF_COUNTS.isolated);
    const hubs = counts.filter((c) => c >= 10);
    expect(hubs.length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...counts)).toBeLessThanOrEqual(30);
    const ordinary = counts.filter((c) => c >= 1 && c <= 4).length;
    expect(ordinary / (300 - PERF_COUNTS.isolated)).toBeGreaterThan(0.5);
  });
});

describe("perfEntityContent", () => {
  it("cite les cibles AUTO par leur nom et les MANUAL par une mention", () => {
    const doc = perfEntityContent("Alber", [
      { kind: "AUTO", name: "Corvi" },
      { kind: "MANUAL", id: "id-2", name: "Draxa" },
      { kind: "AUTO", name: "Elmor" },
    ]);
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Alber croise " },
            { type: "text", text: "Corvi" },
            { type: "text", text: ", " },
            { type: "mention", attrs: { id: "id-2", label: "Draxa" } },
            { type: "text", text: " et " },
            { type: "text", text: "Elmor" },
            { type: "text", text: "." },
          ],
        },
      ],
    });
  });

  it("entree sans cible : une phrase sans aucun autre nom", () => {
    expect(perfEntityContent("Alber", [])).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Alber veille seul." }] }],
    });
  });
});
