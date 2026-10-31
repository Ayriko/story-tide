import { describe, expect, it } from "vitest";
import {
  ARRIVAL_FADE_MS,
  ARRIVAL_TRACE_MS,
  arrivalSchedule,
  EMPTY_ARRIVAL,
  type ArrivalInput,
} from "./sky-arrival";

function stars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${String(i).padStart(3, "0")}`,
    // Eclat decroissant avec l'index, paliers coherents.
    brightness: count - i,
    tier: count - i >= 16 ? 3 : count - i >= 4 ? 2 : 1,
  }));
}

function input(overrides: Partial<ArrivalInput> = {}): ArrivalInput {
  return { stars: [], declaredEdges: [], textEdgeIds: [], reducedMotion: false, ...overrides };
}

describe("arrivalSchedule", () => {
  it("reduced-motion : calendrier vide (etat final direct)", () => {
    expect(
      arrivalSchedule(
        input({
          stars: stars(30),
          declaredEdges: [{ id: "e1", source: "s000", target: "s001" }],
          reducedMotion: true,
        }),
      ),
    ).toEqual(EMPTY_ARRIVAL);
  });

  it("monde vide : calendrier vide", () => {
    expect(arrivalSchedule(input())).toEqual(EMPTY_ARRIVAL);
  });

  it("ordre par eclat decroissant (palier, puis voisins, puis id)", () => {
    const schedule = arrivalSchedule(
      input({
        stars: [
          { id: "faible", tier: 1, brightness: 1 },
          { id: "astre", tier: 3, brightness: 25 },
          { id: "b-moyen", tier: 2, brightness: 5 },
          { id: "a-moyen", tier: 2, brightness: 5 },
          { id: "isolee", tier: 0, brightness: 0 },
        ],
      }),
    );
    expect(schedule.starBatches.flatMap((batch) => batch.ids)).toEqual([
      "astre",
      "a-moyen",
      "b-moyen",
      "faible",
      "isolee",
    ]);
  });

  it("300 entrees : 8 paquets, pas 300 minuteurs, chaque etoile une seule fois", () => {
    const schedule = arrivalSchedule(input({ stars: stars(300) }));
    expect(schedule.starBatches).toHaveLength(8);
    const ids = schedule.starBatches.flatMap((batch) => batch.ids);
    expect(ids).toHaveLength(300);
    expect(new Set(ids).size).toBe(300);
    const sizes = schedule.starBatches.map((batch) => batch.ids.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("paquets echelonnes dans l'ordre, du premier instant a la fin de la phase", () => {
    const { starBatches } = arrivalSchedule(input({ stars: stars(300) }));
    expect(starBatches[0]?.atMs).toBe(0);
    for (let i = 1; i < starBatches.length; i += 1) {
      expect(starBatches[i]?.atMs).toBeGreaterThan(starBatches[i - 1]?.atMs ?? Infinity);
    }
    expect((starBatches.at(-1)?.atMs ?? 0) + ARRIVAL_FADE_MS).toBeLessThanOrEqual(600);
  });

  it("lignes declarees apres les etoiles, en 4 paquets au plus, celles des astres d'abord", () => {
    const all = stars(300);
    const declaredEdges = Array.from({ length: 150 }, (_, i) => ({
      id: `d${String(i).padStart(3, "0")}`,
      source: all[299 - i]?.id ?? "",
      target: all[298 - i]?.id ?? "",
    }));
    const schedule = arrivalSchedule(input({ stars: all, declaredEdges }));
    expect(schedule.lineBatches).toHaveLength(4);
    expect(schedule.lineBatches[0]?.atMs).toBeGreaterThanOrEqual(600);
    expect(schedule.lineBatches.flatMap((batch) => batch.ids)).toHaveLength(150);
    // L'arete des etoiles les plus brillantes (indices 151/150) passe en tete.
    expect(schedule.lineBatches[0]?.ids[0]).toBe("d149");
  });

  it.each([1, 2, 30, 300])("duree totale bornee a ~1 s (%i entrees)", (count) => {
    const all = stars(count);
    const declaredEdges =
      count > 1 ? [{ id: "d", source: all[0]?.id ?? "", target: all[1]?.id ?? "" }] : [];
    const schedule = arrivalSchedule(
      input({ stars: all, declaredEdges, textEdgeIds: count > 2 ? ["t"] : [] }),
    );
    expect(schedule.totalMs).toBeGreaterThan(0);
    expect(schedule.totalMs).toBeLessThanOrEqual(1000);
    const lastLine = schedule.lineBatches.at(-1);
    if (lastLine) {
      expect(lastLine.atMs + ARRIVAL_TRACE_MS).toBe(schedule.totalMs);
    }
  });

  it("liens du texte : un seul fondu, au debut de la phase des lignes", () => {
    const schedule = arrivalSchedule(input({ stars: stars(3), textEdgeIds: ["t1", "t2"] }));
    expect(schedule.textEdges).toEqual({ atMs: 600, ids: ["t1", "t2"] });
    expect(schedule.totalMs).toBe(600 + ARRIVAL_FADE_MS);
  });
});
