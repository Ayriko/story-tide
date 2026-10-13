import { describe, expect, it } from "vitest";
import { changeUserPlanSchema, changeUserRoleSchema, listUsersQuerySchema } from "./admin-schemas";

describe("changeUserPlanSchema", () => {
  it("accepte un plan connu et une raison d'au moins 5 caracteres", () => {
    const parsed = changeUserPlanSchema.safeParse({
      userId: "u1",
      plan: "UNLIMITED",
      reason: "  compte offert  ",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.reason).toBe("compte offert");
  });

  it("refuse une raison trop courte, espaces de bord exclus", () => {
    const parsed = changeUserPlanSchema.safeParse({
      userId: "u1",
      plan: "UNLIMITED",
      reason: "  ami  ",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["reason"]);
  });

  it("refuse un plan hors enum", () => {
    expect(
      changeUserPlanSchema.safeParse({ userId: "u1", plan: "GOLD", reason: "compte offert" })
        .success,
    ).toBe(false);
  });
});

describe("changeUserRoleSchema", () => {
  it("refuse un role hors enum", () => {
    expect(
      changeUserRoleSchema.safeParse({ userId: "u1", role: "ROOT", reason: "nouvel admin" })
        .success,
    ).toBe(false);
  });
});

describe("listUsersQuerySchema", () => {
  it("retombe sur la liste complete, page 1, sans parametre", () => {
    expect(listUsersQuerySchema.parse({})).toEqual({ q: "", page: 1 });
  });

  it("retombe sur la page 1 pour une page fantaisiste, sans lever", () => {
    expect(listUsersQuerySchema.parse({ q: " ael ", page: "abc" })).toEqual({ q: "ael", page: 1 });
    expect(listUsersQuerySchema.parse({ page: "0" }).page).toBe(1);
    expect(listUsersQuerySchema.parse({ page: "3" }).page).toBe(3);
  });
});
