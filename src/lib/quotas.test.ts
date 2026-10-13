import { describe, expect, it } from "vitest";
import { UserPlan } from "@/generated/prisma/client";
import {
  FREE_ENTITY_LIMIT_PER_WORLD,
  FREE_WORLD_LIMIT,
  limitsForPlan,
  nearLimitThreshold,
} from "./quotas";

describe("limitsForPlan", () => {
  it("plafonne le plan FREE a 3 mondes et 50 entrees par monde", () => {
    expect(limitsForPlan(UserPlan.FREE)).toEqual({ worlds: 3, entitiesPerWorld: 50 });
  });

  it("garde les constantes historiques comme source du palier FREE", () => {
    expect(limitsForPlan(UserPlan.FREE)).toEqual({
      worlds: FREE_WORLD_LIMIT,
      entitiesPerWorld: FREE_ENTITY_LIMIT_PER_WORLD,
    });
  });

  it("ne pose aucun plafond en plan UNLIMITED (null sur les deux axes)", () => {
    expect(limitsForPlan(UserPlan.UNLIMITED)).toEqual({ worlds: null, entitiesPerWorld: null });
  });

  it("declare des limites pour chaque plan de l'enum", () => {
    for (const plan of Object.values(UserPlan)) {
      expect(limitsForPlan(plan)).toBeDefined();
    }
  });
});

describe("nearLimitThreshold", () => {
  it("vaut 80 % de la limite, arrondi au superieur", () => {
    expect(nearLimitThreshold(50)).toBe(40);
    expect(nearLimitThreshold(3)).toBe(3);
    expect(nearLimitThreshold(10)).toBe(8);
  });
});
