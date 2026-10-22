import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { CustomRelationType, DeclaredRelation, World } from "@/generated/prisma/client";
import { Prisma, WorldOrigin } from "@/generated/prisma/client";
import { RELATION_TYPES } from "@/lib/relation-types";
import { WorldNotFoundError } from "./world-service";
import {
  CustomRelationTypeNotFoundError,
  LastSelectableRelationTypeError,
  RelationReassignKindError,
  RelationReassignStaleError,
  RelationTypeInUseError,
  RelationTypeLabelTakenError,
  createCustomRelationType,
  deleteCustomRelationType,
  getRelationTypeUsage,
  getWorldRelationTypeCatalog,
  listCustomRelationTypeUsages,
  setNativeRelationTypeHidden,
  updateCustomRelationType,
} from "./relation-type-service";

// Prisma mocke, getWorld() reel (cascade d'autorisation monde -> type
// exercee), meme regle que entity-type-service.test.ts.
vi.mock("@/db/client", () => ({
  prisma: {
    $transaction: vi.fn(),
    world: { findFirst: vi.fn(), update: vi.fn() },
    customRelationType: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    declaredRelation: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const transaction = vi.mocked(prisma.$transaction);
const worldFindFirst = vi.mocked(prisma.world.findFirst);
const worldUpdate = vi.mocked(prisma.world.update);
const typeFindFirst = vi.mocked(prisma.customRelationType.findFirst);
const typeFindMany = vi.mocked(prisma.customRelationType.findMany);
const typeCount = vi.mocked(prisma.customRelationType.count);
const typeCreate = vi.mocked(prisma.customRelationType.create);
const typeUpdate = vi.mocked(prisma.customRelationType.update);
const typeDelete = vi.mocked(prisma.customRelationType.delete);
const relationCount = vi.mocked(prisma.declaredRelation.count);
const relationGroupBy = vi.mocked(prisma.declaredRelation.groupBy);
const relationFindMany = vi.mocked(prisma.declaredRelation.findMany);
const relationDeleteMany = vi.mocked(prisma.declaredRelation.deleteMany);
const relationUpdateMany = vi.mocked(prisma.declaredRelation.updateMany);

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";
const DATE = new Date("2026-10-22T00:00:00.000Z");

function makeWorld(overrides: Partial<World> = {}): World {
  return {
    id: WORLD_ID,
    name: "Eldoria",
    slug: "eldoria",
    ownerId: OWNER_ID,
    origin: WorldOrigin.USER,
    pinnedAt: null,
    hiddenEntityTypes: [],
    hiddenRelationTypes: [],
    createdAt: DATE,
    updatedAt: DATE,
    ...overrides,
  };
}

// Factories completes (skill prisma-mock-partial-select).
function makeType(overrides: Partial<CustomRelationType> = {}): CustomRelationType {
  return {
    id: "rt-suz",
    worldId: WORLD_ID,
    label: "Suzerain de",
    labelKey: "suzerain de",
    inverseLabel: "Vassal de",
    symmetric: false,
    createdAt: DATE,
    updatedAt: DATE,
    ...overrides,
  };
}

function makeRelation(overrides: Partial<DeclaredRelation> = {}): DeclaredRelation {
  return {
    id: "r1",
    worldId: WORLD_ID,
    sourceId: "e-selyne",
    targetId: "e-aldric",
    relationType: "custom",
    customRelationTypeId: "rt-suz",
    typeKey: "custom:rt-suz",
    createdAt: DATE,
    updatedAt: DATE,
    ...overrides,
  };
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("violation", { code, clientVersion: "test" });
}

const SUZERAIN = { label: "Suzerain de", symmetric: false, inverseLabel: "Vassal de" };

// resetAllMocks : vide aussi les files ...Once (skill vitest-clearallmocks-once-queue).
beforeEach(() => {
  vi.resetAllMocks();
  transaction.mockImplementation(async (run) => run(prisma));
});

describe("getWorldRelationTypeCatalog", () => {
  it("monde d'un autre proprietaire : WorldNotFoundError (requete filtree par ownerId)", async () => {
    worldFindFirst.mockResolvedValueOnce(null);
    await expect(getWorldRelationTypeCatalog(OWNER_ID, WORLD_ID)).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(worldFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WORLD_ID, ownerId: OWNER_ID } }),
    );
  });
});

describe("createCustomRelationType", () => {
  it("normalise en NFC et calcule la cle de comparaison", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindMany.mockResolvedValueOnce([]);
    typeCreate.mockResolvedValueOnce(makeType());
    // Forme decomposee (e + accent combinant) : le service doit la recomposer.
    const decomposed = "Vénérateur de".normalize("NFD");

    await createCustomRelationType(OWNER_ID, WORLD_ID, {
      label: decomposed,
      symmetric: false,
      inverseLabel: "Vénéré par lui",
    });

    expect(typeCreate).toHaveBeenCalledWith({
      data: {
        worldId: WORLD_ID,
        label: "Vénérateur de",
        labelKey: "venerateur de",
        inverseLabel: "Vénéré par lui",
        symmetric: false,
      },
    });
  });

  it("refuse un libelle natif ET un inverse natif, casse et accents ignores", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    await expect(
      createCustomRelationType(OWNER_ID, WORLD_ID, { ...SUZERAIN, label: "PARENT DE" }),
    ).rejects.toMatchObject({ name: "RelationTypeLabelTakenError", field: "label" });
    await expect(
      createCustomRelationType(OWNER_ID, WORLD_ID, { ...SUZERAIN, label: "enfant de" }),
    ).rejects.toThrow(RelationTypeLabelTakenError);
    await expect(
      createCustomRelationType(OWNER_ID, WORLD_ID, { ...SUZERAIN, inverseLabel: "Eleve de" }),
    ).rejects.toMatchObject({ field: "inverseLabel" });
    expect(typeCreate).not.toHaveBeenCalled();
  });

  it("refuse un libelle deja pris par le libelle OU l'inverse d'un autre type perso", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    typeFindMany.mockResolvedValue([makeType()]);
    await expect(
      createCustomRelationType(OWNER_ID, WORLD_ID, {
        label: "Vassal de",
        symmetric: false,
        inverseLabel: "Seigneur de",
      }),
    ).rejects.toMatchObject({ field: "label" });
    await expect(
      createCustomRelationType(OWNER_ID, WORLD_ID, {
        label: "Garde de",
        symmetric: false,
        inverseLabel: "suzerain de",
      }),
    ).rejects.toMatchObject({ field: "inverseLabel" });
  });

  it("refuse un inverse identique au libelle", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    await expect(
      createCustomRelationType(OWNER_ID, WORLD_ID, {
        label: "Lié à",
        symmetric: false,
        inverseLabel: "lie a",
      }),
    ).rejects.toThrow("Le libellé inverse doit différer du libellé.");
  });

  it("symetrique : inverse jamais enregistre", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindMany.mockResolvedValueOnce([]);
    typeCreate.mockResolvedValueOnce(makeType());
    await createCustomRelationType(OWNER_ID, WORLD_ID, {
      label: "Pacte",
      symmetric: true,
      inverseLabel: null,
    });
    expect(typeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ symmetric: true, inverseLabel: null }),
    });
  });

  it("course entre deux onglets : P2002 converti, cause chainee", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindMany.mockResolvedValueOnce([]);
    const cause = prismaError("P2002");
    typeCreate.mockRejectedValueOnce(cause);
    await expect(createCustomRelationType(OWNER_ID, WORLD_ID, SUZERAIN)).rejects.toMatchObject({
      name: "RelationTypeLabelTakenError",
      cause,
    });
  });
});

describe("updateCustomRelationType", () => {
  it("type d'un autre monde : introuvable", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(null);
    await expect(
      updateCustomRelationType(OWNER_ID, WORLD_ID, "rt-ailleurs", SUZERAIN),
    ).rejects.toThrow(CustomRelationTypeNotFoundError);
  });

  it("changer la nature d'un type deja utilise est refuse", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeType());
    relationCount.mockResolvedValueOnce(2);
    await expect(
      updateCustomRelationType(OWNER_ID, WORLD_ID, "rt-suz", {
        label: "Suzerain de",
        symmetric: true,
        inverseLabel: null,
      }),
    ).rejects.toThrow(RelationTypeInUseError);
    expect(typeUpdate).not.toHaveBeenCalled();
  });

  it("garder son propre libelle est permis (exclusion de soi-meme)", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeType());
    typeFindMany.mockResolvedValueOnce([]);
    typeUpdate.mockResolvedValueOnce(makeType());
    await updateCustomRelationType(OWNER_ID, WORLD_ID, "rt-suz", SUZERAIN);
    expect(typeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { worldId: WORLD_ID, NOT: { id: "rt-suz" } } }),
    );
  });
});

describe("setNativeRelationTypeHidden", () => {
  it("ajoute le type a la liste des masques", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ hiddenRelationTypes: ["rival"] }));
    await setNativeRelationTypeHidden(OWNER_ID, WORLD_ID, "enemy", true);
    expect(worldUpdate).toHaveBeenCalledWith({
      where: { id: WORLD_ID },
      data: { hiddenRelationTypes: ["rival", "enemy"] },
    });
  });

  it("refuse de masquer le dernier type proposable", async () => {
    const allButOne = RELATION_TYPES.filter((type) => type !== "ally");
    worldFindFirst.mockResolvedValueOnce(makeWorld({ hiddenRelationTypes: allButOne }));
    typeCount.mockResolvedValueOnce(0);
    await expect(setNativeRelationTypeHidden(OWNER_ID, WORLD_ID, "ally", true)).rejects.toThrow(
      LastSelectableRelationTypeError,
    );
    expect(worldUpdate).not.toHaveBeenCalled();
  });
});

describe("getRelationTypeUsage", () => {
  it("compte les relations par cle de type", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    relationGroupBy.mockResolvedValueOnce([
      {
        ...makeRelation({ typeKey: "parent" }),
        _count: { _all: 3 },
        _max: undefined,
        _min: undefined,
      },
    ]);
    await expect(getRelationTypeUsage(OWNER_ID, WORLD_ID)).resolves.toEqual({ parent: 3 });
  });
});

describe("listCustomRelationTypeUsages", () => {
  it("liste les relations de chaque type perso, avec les autres types de la meme paire", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    relationFindMany
      .mockResolvedValueOnce([
        Object.assign(makeRelation(), {
          source: { name: "Selyne" },
          target: { name: "Aldric" },
        }),
      ])
      .mockResolvedValueOnce([
        makeRelation(),
        makeRelation({
          id: "r2",
          relationType: "leads",
          customRelationTypeId: null,
          typeKey: "leads",
        }),
        makeRelation({ id: "r3", targetId: "e-autre", relationType: "ally", typeKey: "ally" }),
      ]);

    await expect(listCustomRelationTypeUsages(OWNER_ID, WORLD_ID)).resolves.toEqual({
      "rt-suz": [
        { id: "r1", sourceName: "Selyne", targetName: "Aldric", existingTypeKeys: ["leads"] },
      ],
    });
  });
});

describe("deleteCustomRelationType", () => {
  function arrange(relations: DeclaredRelation[]) {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeType());
    relationFindMany.mockResolvedValueOnce(relations);
  }

  it("reaffecte vers un natif de meme nature puis supprime le type, en transaction", async () => {
    arrange([makeRelation()]);
    relationFindMany.mockResolvedValueOnce([]);

    await deleteCustomRelationType(OWNER_ID, WORLD_ID, "rt-suz", { r1: "leads" });

    expect(transaction).toHaveBeenCalledOnce();
    expect(relationUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["r1"] }, worldId: WORLD_ID },
      data: { relationType: "leads", customRelationTypeId: null, typeKey: "leads" },
    });
    expect(relationDeleteMany).not.toHaveBeenCalled();
    expect(typeDelete).toHaveBeenCalledWith({ where: { id: "rt-suz" } });
  });

  it("doublon : la paire porte deja le type cible, la relation reaffectee est supprimee", async () => {
    arrange([makeRelation(), makeRelation({ id: "r2", targetId: "e-mira" })]);
    relationFindMany.mockResolvedValueOnce([
      makeRelation({
        id: "r9",
        relationType: "leads",
        customRelationTypeId: null,
        typeKey: "leads",
      }),
    ]);

    await deleteCustomRelationType(OWNER_ID, WORLD_ID, "rt-suz", { r1: "leads", r2: "leads" });

    expect(relationDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["r1"] }, worldId: WORLD_ID },
    });
    expect(relationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["r2"] }, worldId: WORLD_ID } }),
    );
  });

  it("refuse une cible de nature differente (dirige -> symetrique)", async () => {
    arrange([makeRelation()]);
    await expect(
      deleteCustomRelationType(OWNER_ID, WORLD_ID, "rt-suz", { r1: "ally" }),
    ).rejects.toThrow(RelationReassignKindError);
    expect(typeDelete).not.toHaveBeenCalled();
  });

  it("refuse une cible perso d'un autre monde", async () => {
    arrange([makeRelation()]);
    typeFindFirst.mockResolvedValueOnce(null);
    await expect(
      deleteCustomRelationType(OWNER_ID, WORLD_ID, "rt-suz", { r1: "custom:rt-ailleurs" }),
    ).rejects.toThrow(CustomRelationTypeNotFoundError);
  });

  it("carte perimee (relation manquante ou en trop) : refus", async () => {
    arrange([makeRelation(), makeRelation({ id: "r2" })]);
    await expect(
      deleteCustomRelationType(OWNER_ID, WORLD_ID, "rt-suz", { r1: "leads" }),
    ).rejects.toThrow(RelationReassignStaleError);
  });

  it("relation rattachee entre relecture et suppression : FK convertie en carte perimee", async () => {
    arrange([]);
    const cause = prismaError("P2003");
    typeDelete.mockRejectedValueOnce(cause);
    await expect(deleteCustomRelationType(OWNER_ID, WORLD_ID, "rt-suz", {})).rejects.toMatchObject({
      name: "RelationReassignStaleError",
      cause,
    });
  });

  it("dernier type proposable (natifs tous masques, seul perso) : refus", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ hiddenRelationTypes: [...RELATION_TYPES] }));
    typeFindFirst.mockResolvedValueOnce(makeType());
    typeCount.mockResolvedValueOnce(1);
    await expect(deleteCustomRelationType(OWNER_ID, WORLD_ID, "rt-suz", {})).rejects.toThrow(
      LastSelectableRelationTypeError,
    );
  });
});
