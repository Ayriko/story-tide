import { describe, expect, it } from "vitest";
import {
  ENTITY_TYPES,
  ENTITY_TYPE_GROUPS,
  createEntitySchema,
  entityTypeGroup,
  entityTypeLabel,
  groupedEntityTypes,
} from "./entity-schemas";

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

  it("accepte les 26 types de la taxonomie (KAN-18)", () => {
    for (const type of ENTITY_TYPES) {
      const result = createEntitySchema.safeParse({ name: "Aeliana", type });
      expect(result.success).toBe(true);
    }
  });
});

describe("entityTypeLabel", () => {
  it("retourne le libelle francais pour un type connu", () => {
    expect(entityTypeLabel("character")).toBe("Personnage");
  });

  it("retourne le libelle francais pour un type ajoute par KAN-18", () => {
    expect(entityTypeLabel("magic-system")).toBe("Système magique");
  });

  it("retourne la valeur brute pour un type inconnu (donnee legacy/inattendue)", () => {
    expect(entityTypeLabel("wizard")).toBe("wizard");
  });
});

describe("entityTypeGroup", () => {
  it("retourne le groupe d'un type connu", () => {
    expect(entityTypeGroup("character")).toBe("Personnages");
    expect(entityTypeGroup("weapon")).toBe("Objets");
  });

  it("retourne undefined pour un type inconnu (pas de groupe 'Divers' implicite)", () => {
    expect(entityTypeGroup("wizard")).toBeUndefined();
  });
});

describe("groupedEntityTypes", () => {
  it("conserve les 5 ids historiques a l'identique (character/place/faction/object/event)", () => {
    const allTypes = groupedEntityTypes().flatMap(({ types }) => types);
    for (const legacyType of ["character", "place", "faction", "object", "event"]) {
      expect(allTypes).toContain(legacyType);
    }
  });

  it("couvre les 26 types repartis sur les 8 groupes, sans doublon ni omission", () => {
    const groups = groupedEntityTypes();
    expect(groups.map((g) => g.group)).toEqual([...ENTITY_TYPE_GROUPS]);

    const allTypes = groups.flatMap((g) => g.types);
    expect(allTypes).toHaveLength(ENTITY_TYPES.length);
    expect(new Set(allTypes).size).toBe(ENTITY_TYPES.length);
  });

  it("ne produit jamais un groupe vide", () => {
    for (const { types } of groupedEntityTypes()) {
      expect(types.length).toBeGreaterThan(0);
    }
  });
});
