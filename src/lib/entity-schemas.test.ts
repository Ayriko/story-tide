import { describe, expect, it } from "vitest";
import { createEntitySchema, entityTypeLabel } from "./entity-schemas";

describe("createEntitySchema", () => {
  it("accepte des donnees valides et nettoie le nom (trim)", () => {
    const result = createEntitySchema.parse({
      name: "  Aeliana  ",
      type: "character",
      aliases: ["La Reine", "L'Ombre"],
    });

    expect(result).toEqual({
      name: "Aeliana",
      type: "character",
      aliases: ["La Reine", "L'Ombre"],
    });
  });

  it("applique un tableau d'aliases vide par defaut", () => {
    const result = createEntitySchema.parse({ name: "Aeliana", type: "character" });
    expect(result.aliases).toEqual([]);
  });

  it("nettoie les aliases (trim, doublons, entrees vides supprimees)", () => {
    const result = createEntitySchema.parse({
      name: "Aeliana",
      type: "character",
      aliases: ["  La Reine  ", "La Reine", "", "   "],
    });

    expect(result.aliases).toEqual(["La Reine"]);
  });

  it("rejette un nom vide", () => {
    const result = createEntitySchema.safeParse({ name: "   ", type: "character" });
    expect(result.success).toBe(false);
  });

  it("rejette un type inconnu", () => {
    const result = createEntitySchema.safeParse({ name: "Aeliana", type: "wizard" });
    expect(result.success).toBe(false);
  });
});

describe("entityTypeLabel", () => {
  it("retourne le libelle francais pour un type connu", () => {
    expect(entityTypeLabel("character")).toBe("Personnage");
  });

  it("retourne la valeur brute pour un type inconnu (donnee legacy/inattendue)", () => {
    expect(entityTypeLabel("wizard")).toBe("wizard");
  });
});
