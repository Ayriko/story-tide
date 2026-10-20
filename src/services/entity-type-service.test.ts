import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { CustomEntityType, Entity, World } from "@/generated/prisma/client";
import { Prisma, WorldOrigin } from "@/generated/prisma/client";
import { ENTITY_TYPES } from "@/lib/entity-schemas";
import { WorldNotFoundError } from "./world-service";
import {
  CustomTypeLabelTakenError,
  CustomTypeNotFoundError,
  LastSelectableTypeError,
  ReassignMapStaleError,
  createCustomType,
  deleteCustomType,
  getTypeUsage,
  getWorldTypeCatalog,
  listCustomTypeEntries,
  setNativeTypeHidden,
  updateCustomType,
} from "./entity-type-service";

// Meme regle que entity-service.test.ts : Prisma mocke, aucune connexion
// reelle ; getWorld() (world-service) n'est pas mocke - la cascade
// d'autorisation monde -> type est reellement exercee.
vi.mock("@/db/client", () => ({
  prisma: {
    $transaction: vi.fn(),
    world: { findFirst: vi.fn(), update: vi.fn() },
    entity: { findMany: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn() },
    customEntityType: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const transaction = vi.mocked(prisma.$transaction);
const worldFindFirst = vi.mocked(prisma.world.findFirst);
const worldUpdate = vi.mocked(prisma.world.update);
const entityFindMany = vi.mocked(prisma.entity.findMany);
const entityGroupBy = vi.mocked(prisma.entity.groupBy);
const entityUpdateMany = vi.mocked(prisma.entity.updateMany);
const typeFindFirst = vi.mocked(prisma.customEntityType.findFirst);
const typeCount = vi.mocked(prisma.customEntityType.count);
const typeCreate = vi.mocked(prisma.customEntityType.create);
const typeUpdate = vi.mocked(prisma.customEntityType.update);
const typeDelete = vi.mocked(prisma.customEntityType.delete);

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";

function makeWorld(overrides: Partial<World> = {}): World {
  return {
    id: WORLD_ID,
    name: "Eldoria",
    slug: "eldoria",
    ownerId: OWNER_ID,
    origin: WorldOrigin.USER,
    pinnedAt: null,
    hiddenEntityTypes: [],
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeCustomType(overrides: Partial<CustomEntityType> = {}): CustomEntityType {
  return {
    id: "ct-ship",
    worldId: WORLD_ID,
    label: "Vaisseau",
    labelKey: "vaisseau",
    group: "Objets",
    icon: "ship",
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:00:00.000Z"),
    ...overrides,
  };
}

// Objet complet malgre les select restreints reels (convention
// prisma-mock-partial-select : le mock reste type sur le modele complet).
function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "e1",
    worldId: WORLD_ID,
    name: "Aube Grise",
    type: "custom",
    customTypeId: "ct-ship",
    content: {},
    plainText: "",
    seedRef: null,
    folderId: null,
    contentVersion: 0,
    scannedVersion: 0,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:00:00.000Z"),
    ...overrides,
  };
}

// Ligne de groupBy complete (toutes les colonnes + agregats), sans cast -
// seuls type, customTypeId et _count._all sont lus par getTypeUsage.
function makeUsageRow(entity: Entity, count: number) {
  return {
    ...entity,
    _count: { _all: count },
    _avg: undefined,
    _max: undefined,
    _min: undefined,
    _sum: undefined,
  };
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("violation", {
    code,
    clientVersion: "test",
  });
}

const SHIP_INPUT = { label: "Vaisseau", group: "Objets", icon: "ship" } as const;

// mockReset (et pas clearAllMocks) : vide aussi les files ...Once d'un test
// en echec, jamais heritees par le suivant (skill vitest-clearallmocks-once-queue).
// Transaction interactive : le callback recoit le MEME client mocke.
beforeEach(() => {
  vi.resetAllMocks();
  transaction.mockImplementation(async (run) => run(prisma));
});

describe("getWorldTypeCatalog", () => {
  it("charge types personnalises et natifs masques en une requete filtree par proprietaire", async () => {
    // Le select imbrique ajoute la relation customEntityTypes, absente du type
    // World du mock : objet complet + relation, sans cast (skill
    // prisma-mock-partial-select).
    const worldWithTypes: World & { customEntityTypes: CustomEntityType[] } = {
      ...makeWorld({ hiddenEntityTypes: ["prophecy"] }),
      customEntityTypes: [makeCustomType()],
    };
    worldFindFirst.mockResolvedValueOnce(worldWithTypes);

    const catalog = await getWorldTypeCatalog(OWNER_ID, WORLD_ID);

    expect(catalog).toEqual({ custom: [makeCustomType()], hidden: ["prophecy"] });
    expect(worldFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WORLD_ID, ownerId: OWNER_ID } }),
    );
  });

  it("monde d'autrui : WorldNotFoundError", async () => {
    worldFindFirst.mockResolvedValueOnce(null);
    await expect(getWorldTypeCatalog("intrus", WORLD_ID)).rejects.toThrow(WorldNotFoundError);
  });
});

describe("createCustomType", () => {
  it("normalise le libelle en NFC et calcule labelKey (casse/accents)", async () => {
    const nfc = "Épée-vive";
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(null);
    typeCreate.mockResolvedValueOnce(makeCustomType({ label: nfc }));

    await createCustomType(OWNER_ID, WORLD_ID, { ...SHIP_INPUT, label: nfc.normalize("NFD") });

    expect(typeCreate).toHaveBeenCalledWith({
      data: {
        worldId: WORLD_ID,
        label: nfc,
        labelKey: "epee-vive",
        group: "Objets",
        icon: "ship",
      },
    });
  });

  it("refuse un libelle natif, quelles que soient casse et accents", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());

    await expect(
      createCustomType(OWNER_ID, WORLD_ID, { ...SHIP_INPUT, label: "PERSONNAGÉ" }),
    ).rejects.toThrow(CustomTypeLabelTakenError);
    expect(typeCreate).not.toHaveBeenCalled();
  });

  it("refuse un libelle deja pris par un autre type personnalise du monde", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeCustomType());

    await expect(
      createCustomType(OWNER_ID, WORLD_ID, { ...SHIP_INPUT, label: "VAISSÉAU" }),
    ).rejects.toThrow(CustomTypeLabelTakenError);
    expect(typeFindFirst).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID, labelKey: "vaisseau" },
      select: { id: true },
    });
    expect(typeCreate).not.toHaveBeenCalled();
  });

  it("course entre deux onglets : le P2002 de l'index unique devient l'erreur typee, cause chainee", async () => {
    const violation = prismaError("P2002");
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(null);
    typeCreate.mockRejectedValueOnce(violation);

    const error = await createCustomType(OWNER_ID, WORLD_ID, SHIP_INPUT).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CustomTypeLabelTakenError);
    expect(error).toHaveProperty("cause", violation);
  });

  it("monde d'autrui : WorldNotFoundError, rien n'est cree", async () => {
    worldFindFirst.mockResolvedValueOnce(null);
    await expect(createCustomType("intrus", WORLD_ID, SHIP_INPUT)).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(typeCreate).not.toHaveBeenCalled();
  });
});

describe("updateCustomType", () => {
  it("met a jour libelle, groupe et icone ; l'unicite exclut le type lui-meme", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeCustomType()).mockResolvedValueOnce(null);
    typeUpdate.mockResolvedValueOnce(makeCustomType({ label: "Navire" }));

    await updateCustomType(OWNER_ID, WORLD_ID, "ct-ship", {
      label: "Navire",
      group: "Lieux",
      icon: "castle",
    });

    expect(typeFindFirst).toHaveBeenLastCalledWith({
      where: { worldId: WORLD_ID, labelKey: "navire", NOT: { id: "ct-ship" } },
      select: { id: true },
    });
    expect(typeUpdate).toHaveBeenCalledWith({
      where: { id: "ct-ship" },
      data: { label: "Navire", labelKey: "navire", group: "Lieux", icon: "castle" },
    });
  });

  it("type d'un autre monde : CustomTypeNotFoundError", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(null);

    await expect(updateCustomType(OWNER_ID, WORLD_ID, "ct-autrui", SHIP_INPUT)).rejects.toThrow(
      CustomTypeNotFoundError,
    );
    expect(typeUpdate).not.toHaveBeenCalled();
  });
});

describe("setNativeTypeHidden", () => {
  it("ajoute la cle aux masques (sans doublon)", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ hiddenEntityTypes: ["era"] }));

    await setNativeTypeHidden(OWNER_ID, WORLD_ID, "prophecy", true);

    expect(worldUpdate).toHaveBeenCalledWith({
      where: { id: WORLD_ID },
      data: { hiddenEntityTypes: ["era", "prophecy"] },
    });
  });

  it("retire la cle des masques", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ hiddenEntityTypes: ["era", "prophecy"] }));

    await setNativeTypeHidden(OWNER_ID, WORLD_ID, "prophecy", false);

    expect(worldUpdate).toHaveBeenCalledWith({
      where: { id: WORLD_ID },
      data: { hiddenEntityTypes: ["era"] },
    });
  });

  it("refuse de masquer le dernier type proposable (aucun personnalise)", async () => {
    const allButNote = ENTITY_TYPES.filter((type) => type !== "note");
    worldFindFirst.mockResolvedValueOnce(makeWorld({ hiddenEntityTypes: allButNote }));
    typeCount.mockResolvedValueOnce(0);

    await expect(setNativeTypeHidden(OWNER_ID, WORLD_ID, "note", true)).rejects.toThrow(
      LastSelectableTypeError,
    );
    expect(worldUpdate).not.toHaveBeenCalled();
  });

  it("permet de masquer tous les natifs s'il reste un type personnalise", async () => {
    const allButNote = ENTITY_TYPES.filter((type) => type !== "note");
    worldFindFirst.mockResolvedValueOnce(makeWorld({ hiddenEntityTypes: allButNote }));
    typeCount.mockResolvedValueOnce(1);

    await setNativeTypeHidden(OWNER_ID, WORLD_ID, "note", true);

    expect(worldUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("getTypeUsage / listCustomTypeEntries", () => {
  it("compte les entrees par cle resolue", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityGroupBy.mockResolvedValueOnce([
      makeUsageRow(makeEntity({ type: "character", customTypeId: null }), 3),
      makeUsageRow(makeEntity(), 2),
    ]);

    expect(await getTypeUsage(OWNER_ID, WORLD_ID)).toEqual({
      character: 3,
      "custom:ct-ship": 2,
    });
  });

  it("regroupe les entrees des types personnalises par id de type", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([
      makeEntity({ id: "e1", name: "Aube Grise" }),
      makeEntity({ id: "e2", name: "Brise-Lame", customTypeId: "ct-bag" }),
    ]);

    expect(await listCustomTypeEntries(OWNER_ID, WORLD_ID)).toEqual({
      "ct-ship": [{ id: "e1", name: "Aube Grise" }],
      "ct-bag": [{ id: "e2", name: "Brise-Lame" }],
    });
  });
});

describe("deleteCustomType", () => {
  it("sans entree : supprime le type dans la transaction", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeCustomType());
    entityFindMany.mockResolvedValueOnce([]);

    await deleteCustomType(OWNER_ID, WORLD_ID, "ct-ship", {});

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(entityUpdateMany).not.toHaveBeenCalled();
    expect(typeDelete).toHaveBeenCalledWith({ where: { id: "ct-ship" } });
  });

  it("carte complete : reaffecte chaque entree a sa cible puis supprime le type", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst
      .mockResolvedValueOnce(makeCustomType())
      .mockResolvedValueOnce(makeCustomType({ id: "ct-bag" }));
    entityFindMany.mockResolvedValueOnce([makeEntity({ id: "e1" }), makeEntity({ id: "e2" })]);

    await deleteCustomType(OWNER_ID, WORLD_ID, "ct-ship", { e1: "object", e2: "custom:ct-bag" });

    expect(entityUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["e1"] }, worldId: WORLD_ID },
      data: { type: "object", customTypeId: null },
    });
    expect(entityUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["e2"] }, worldId: WORLD_ID },
      data: { type: "custom", customTypeId: "ct-bag" },
    });
    expect(typeDelete).toHaveBeenCalledWith({ where: { id: "ct-ship" } });
  });

  it("cible native masquee permise", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ hiddenEntityTypes: ["object"] }));
    typeFindFirst.mockResolvedValueOnce(makeCustomType());
    entityFindMany.mockResolvedValueOnce([makeEntity({ id: "e1" })]);

    await deleteCustomType(OWNER_ID, WORLD_ID, "ct-ship", { e1: "object" });

    expect(typeDelete).toHaveBeenCalledTimes(1);
  });

  it("carte incomplete : refus, rien n'est modifie", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeCustomType());
    entityFindMany.mockResolvedValueOnce([makeEntity({ id: "e1" }), makeEntity({ id: "e2" })]);

    await expect(deleteCustomType(OWNER_ID, WORLD_ID, "ct-ship", { e1: "object" })).rejects.toThrow(
      ReassignMapStaleError,
    );
    expect(entityUpdateMany).not.toHaveBeenCalled();
    expect(typeDelete).not.toHaveBeenCalled();
  });

  it("carte perimee (entree qui n'est plus du type) : refus", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeCustomType());
    entityFindMany.mockResolvedValueOnce([makeEntity({ id: "e1" })]);

    await expect(deleteCustomType(OWNER_ID, WORLD_ID, "ct-ship", { e9: "object" })).rejects.toThrow(
      ReassignMapStaleError,
    );
    expect(typeDelete).not.toHaveBeenCalled();
  });

  it("cible personnalisee d'un autre monde : introuvable, rien n'est supprime", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeCustomType()).mockResolvedValueOnce(null);
    entityFindMany.mockResolvedValueOnce([makeEntity({ id: "e1" })]);

    await expect(
      deleteCustomType(OWNER_ID, WORLD_ID, "ct-ship", { e1: "custom:ct-autrui" }),
    ).rejects.toThrow(CustomTypeNotFoundError);
    expect(typeDelete).not.toHaveBeenCalled();
  });

  it("cible = le type supprime lui-meme : refus", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeCustomType());
    entityFindMany.mockResolvedValueOnce([makeEntity({ id: "e1" })]);

    await expect(
      deleteCustomType(OWNER_ID, WORLD_ID, "ct-ship", { e1: "custom:ct-ship" }),
    ).rejects.toThrow(CustomTypeNotFoundError);
    expect(typeDelete).not.toHaveBeenCalled();
  });

  it("type d'un autre monde : introuvable", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(null);

    await expect(deleteCustomType(OWNER_ID, WORLD_ID, "ct-autrui", {})).rejects.toThrow(
      CustomTypeNotFoundError,
    );
  });

  it("dernier type proposable (tous natifs masques, un seul personnalise) : refus", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ hiddenEntityTypes: [...ENTITY_TYPES] }));
    typeFindFirst.mockResolvedValueOnce(makeCustomType());
    typeCount.mockResolvedValueOnce(1);

    await expect(deleteCustomType(OWNER_ID, WORLD_ID, "ct-ship", {})).rejects.toThrow(
      LastSelectableTypeError,
    );
    expect(typeDelete).not.toHaveBeenCalled();
  });

  it("entree rattachee entre relecture et DELETE (FK NO ACTION, P2003) : carte perimee, cause chainee", async () => {
    const violation = prismaError("P2003");
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    typeFindFirst.mockResolvedValueOnce(makeCustomType());
    entityFindMany.mockResolvedValueOnce([]);
    typeDelete.mockRejectedValueOnce(violation);

    const error = await deleteCustomType(OWNER_ID, WORLD_ID, "ct-ship", {}).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ReassignMapStaleError);
    expect(error).toHaveProperty("cause", violation);
  });
});
