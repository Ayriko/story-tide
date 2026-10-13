import { describe, expect, it } from "vitest";
import { bucketActivity, dayKey } from "./activity-buckets";

const NOW = new Date("2026-10-13T10:00:00.000Z");

describe("dayKey", () => {
  it("rend le jour civil a Paris, pas le jour UTC", () => {
    // 22:30 UTC le 12 = 00:30 le 13 a Paris (UTC+2 en ete).
    expect(dayKey(new Date("2026-10-12T22:30:00.000Z"))).toBe("2026-10-13");
    expect(dayKey(new Date("2026-10-12T21:30:00.000Z"))).toBe("2026-10-12");
  });
});

describe("bucketActivity", () => {
  it("rend 30 jours consecutifs, du plus ancien au plus recent, aujourd'hui inclus", () => {
    const days = bucketActivity([], NOW);

    expect(days).toHaveLength(30);
    expect(days[0]?.date).toBe("2026-09-14");
    expect(days[29]?.date).toBe("2026-10-13");
    expect(days.every((day) => day.created === 0 && day.modified === 0)).toBe(true);
  });

  it("compte une creation au jour de createdAt et une modification au jour de updatedAt", () => {
    const days = bucketActivity(
      [
        {
          createdAt: new Date("2026-10-10T09:00:00.000Z"),
          updatedAt: new Date("2026-10-12T09:00:00.000Z"),
        },
        {
          createdAt: new Date("2026-10-12T08:00:00.000Z"),
          updatedAt: new Date("2026-10-12T08:00:00.000Z"),
        },
      ],
      NOW,
    );
    const byDate = new Map(days.map((day) => [day.date, day]));

    expect(byDate.get("2026-10-10")).toEqual({ date: "2026-10-10", created: 1, modified: 0 });
    expect(byDate.get("2026-10-12")).toEqual({ date: "2026-10-12", created: 1, modified: 2 });
  });

  it("ignore une creation anterieure a la fenetre mais garde sa modification recente", () => {
    const days = bucketActivity(
      [
        {
          createdAt: new Date("2026-01-01T09:00:00.000Z"),
          updatedAt: new Date("2026-10-13T08:00:00.000Z"),
        },
      ],
      NOW,
    );

    expect(days.reduce((sum, day) => sum + day.created, 0)).toBe(0);
    expect(days[29]).toEqual({ date: "2026-10-13", created: 0, modified: 1 });
  });

  it("ne saute ni ne double aucun jour au changement d'heure (25 octobre 2026)", () => {
    const days = bucketActivity([], new Date("2026-10-27T23:30:00.000Z"), 5);

    expect(days.map((day) => day.date)).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
  });
});
