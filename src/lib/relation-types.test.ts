import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RELATION_TYPES,
  RELATION_TYPE_REFERENCE,
  customRelationTypeKey,
  labelFrom,
  parseRelationChoice,
  parseRelationTypeKey,
  relationChoiceValue,
  resolveRelationType,
  selectableRelationTypes,
  type WorldRelationTypeCatalog,
} from "./relation-types";
import {
  customRelationTypeSchema,
  declaredRelationSchema,
  relationReassignMapSchema,
} from "./relation-type-schemas";

const SUZERAIN = { id: "rt1", label: "Suzerain de", inverseLabel: "Vassal de", symmetric: false };
const PACTE = { id: "rt2", label: "Pacte", inverseLabel: null, symmetric: true };
const CATALOG: WorldRelationTypeCatalog = { custom: [SUZERAIN, PACTE], hidden: ["worships"] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registre natif", () => {
  it("compte 6 symetriques et 8 diriges, avec les libelles de la spec", () => {
    const symmetric = RELATION_TYPES.filter((type) => !RELATION_TYPE_REFERENCE[type].inverseLabel);
    expect(symmetric).toEqual(["ally", "friend", "rival", "enemy", "family", "spouse"]);
    expect(RELATION_TYPES).toHaveLength(14);
    expect(RELATION_TYPE_REFERENCE.parent).toEqual({
      label: "Parent de",
      inverseLabel: "Enfant de",
    });
    expect(RELATION_TYPE_REFERENCE.owns).toEqual({
      label: "Possède",
      inverseLabel: "Appartient à",
    });
  });
});

describe("resolveRelationType", () => {
  it("resout un natif dirige", () => {
    expect(
      resolveRelationType({ relationType: "parent", customRelationTypeId: null }, CATALOG),
    ).toEqual({
      key: "parent",
      label: "Parent de",
      inverseLabel: "Enfant de",
      symmetric: false,
      isCustom: false,
      isHidden: false,
    });
  });

  it("marque un natif masque, sans le perdre", () => {
    expect(
      resolveRelationType({ relationType: "worships", customRelationTypeId: null }, CATALOG),
    ).toMatchObject({ key: "worships", label: "Vénère", isHidden: true });
  });

  it("resout un type perso dirige et un perso symetrique", () => {
    expect(
      resolveRelationType({ relationType: "custom", customRelationTypeId: "rt1" }, CATALOG),
    ).toEqual({
      key: "custom:rt1",
      label: "Suzerain de",
      inverseLabel: "Vassal de",
      symmetric: false,
      isCustom: true,
      isHidden: false,
    });
    expect(
      resolveRelationType({ relationType: "custom", customRelationTypeId: "rt2" }, CATALOG),
    ).toMatchObject({ key: "custom:rt2", symmetric: true, inverseLabel: null });
  });

  it("orphelin (perso absent du catalogue) : « Type inconnu », trace console, jamais « custom »", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const resolved = resolveRelationType(
      { relationType: "custom", customRelationTypeId: "disparu" },
      CATALOG,
    );
    expect(resolved).toMatchObject({ key: "custom:disparu", label: "Type inconnu" });
    expect(error).toHaveBeenCalledOnce();
  });

  it("cle native inconnue : « Type inconnu », trace console", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      resolveRelationType({ relationType: "inconnu", customRelationTypeId: null }, CATALOG).label,
    ).toBe("Type inconnu");
    expect(error).toHaveBeenCalledOnce();
  });
});

describe("labelFrom", () => {
  const parent = resolveRelationType(
    { relationType: "parent", customRelationTypeId: null },
    CATALOG,
  );
  const ally = resolveRelationType({ relationType: "ally", customRelationTypeId: null }, CATALOG);

  it("lit le libelle depuis la source, l'inverse depuis la cible d'un dirige", () => {
    expect(labelFrom(parent, "source")).toBe("Parent de");
    expect(labelFrom(parent, "target")).toBe("Enfant de");
  });

  it("lit le meme libelle des deux fiches pour un symetrique", () => {
    expect(labelFrom(ally, "source")).toBe("Allié");
    expect(labelFrom(ally, "target")).toBe("Allié");
  });
});

describe("cles et choix", () => {
  it("parseRelationTypeKey : natif, perso, inconnu", () => {
    expect(parseRelationTypeKey("leads")).toEqual({
      relationType: "leads",
      customRelationTypeId: null,
    });
    expect(parseRelationTypeKey(customRelationTypeKey("rt1"))).toEqual({
      relationType: "custom",
      customRelationTypeId: "rt1",
    });
    expect(parseRelationTypeKey("custom:")).toBeNull();
    expect(parseRelationTypeKey("vole")).toBeNull();
  });

  it("parseRelationChoice : aller-retour, refus d'une valeur mal formee", () => {
    const value = relationChoiceValue({ key: "custom:rt1", viewpoint: "target" });
    expect(value).toBe("custom:rt1|target");
    expect(parseRelationChoice(value)).toEqual({ key: "custom:rt1", viewpoint: "target" });
    expect(parseRelationChoice("parent")).toBeNull();
    expect(parseRelationChoice("parent|ailleurs")).toBeNull();
    expect(parseRelationChoice("inconnu|source")).toBeNull();
  });
});

describe("selectableRelationTypes", () => {
  it("une option par symetrique, deux par dirige (libelle et inverse), masques exclus", () => {
    const { symmetric, directed } = selectableRelationTypes(CATALOG);

    expect(symmetric.map((option) => option.label)).toEqual([
      "Allié",
      "Ami",
      "Rival",
      "Ennemi",
      "Famille",
      "Conjoint",
      "Pacte",
    ]);
    expect(directed.map((option) => option.value)).toContain("parent|source");
    expect(directed.find((option) => option.value === "parent|target")?.label).toBe("Enfant de");
    expect(directed.find((option) => option.value === "custom:rt1|target")).toMatchObject({
      label: "Vassal de",
      isCustom: true,
    });
    expect(directed.some((option) => option.key === "worships")).toBe(false);
  });
});

describe("customRelationTypeSchema", () => {
  it("dirige sans inverse : refuse sur le champ inverse", () => {
    const parsed = customRelationTypeSchema.safeParse({
      label: "Suzerain de",
      symmetric: false,
      inverseLabel: "  ",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["inverseLabel"]);
  });

  it("symetrique avec inverse : refuse", () => {
    expect(
      customRelationTypeSchema.safeParse({ label: "Pacte", symmetric: true, inverseLabel: "X" })
        .success,
    ).toBe(false);
  });

  it("symetrique sans inverse : inverse normalise a null", () => {
    expect(
      customRelationTypeSchema.parse({ label: " Pacte ", symmetric: true, inverseLabel: "" }),
    ).toEqual({ label: "Pacte", symmetric: true, inverseLabel: null });
  });

  it("sens non choisi : refuse", () => {
    expect(
      customRelationTypeSchema.safeParse({ label: "Pacte", symmetric: undefined, inverseLabel: "" })
        .success,
    ).toBe(false);
  });
});

describe("schemas de relation", () => {
  it("declaredRelationSchema : convertit le choix, exige une entree", () => {
    expect(declaredRelationSchema.parse({ otherId: "e2", choice: "owns|target" })).toEqual({
      otherId: "e2",
      choice: { key: "owns", viewpoint: "target" },
    });
    expect(declaredRelationSchema.safeParse({ otherId: "", choice: "owns|target" }).success).toBe(
      false,
    );
    expect(declaredRelationSchema.safeParse({ otherId: "e2", choice: "" }).success).toBe(false);
  });

  it("relationReassignMapSchema : refuse une cle cible invalide", () => {
    expect(relationReassignMapSchema.safeParse({ r1: "leads", r2: "custom:rt9" }).success).toBe(
      true,
    );
    expect(relationReassignMapSchema.safeParse({ r1: "custom:" }).success).toBe(false);
  });
});
