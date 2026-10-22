import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type {
  CustomRelationType,
  DeclaredRelation,
  Entity,
  Relation,
  RelationSuggestionIgnore,
  World,
} from "@/generated/prisma/client";
import { Prisma, RelationOrigin, WorldOrigin } from "@/generated/prisma/client";
import { EntityNotFoundError } from "./entity-service";
import { CustomRelationTypeNotFoundError } from "./relation-type-service";
import { WorldNotFoundError } from "./world-service";
import {
  DeclaredRelationDuplicateError,
  DeclaredRelationNotFoundError,
  RelationTypeHiddenError,
  SelfRelationError,
  createDeclaredRelation,
  deleteDeclaredRelation,
  ignoreRelationSuggestion,
  listDeclaredRelationsForEntity,
  listIgnoredRelationSuggestions,
  listRelationSuggestions,
  listWorldDeclaredRelations,
  unignoreRelationSuggestion,
} from "./declared-relation-service";

// Prisma mocke ; getWorld/getEntity et les catalogues (world.findFirst) sont
// reels - l'autorisation monde -> fiche -> autre entree -> type est exercee.
vi.mock("@/db/client", () => ({
  prisma: {
    world: { findFirst: vi.fn() },
    entity: { findFirst: vi.fn(), findMany: vi.fn() },
    relation: { findMany: vi.fn() },
    declaredRelation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    relationSuggestionIgnore: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

const worldFindFirst = vi.mocked(prisma.world.findFirst);
const entityFindFirst = vi.mocked(prisma.entity.findFirst);
const entityFindMany = vi.mocked(prisma.entity.findMany);
const relationFindMany = vi.mocked(prisma.relation.findMany);
const declaredCreate = vi.mocked(prisma.declaredRelation.create);
const declaredFindFirst = vi.mocked(prisma.declaredRelation.findFirst);
const declaredFindMany = vi.mocked(prisma.declaredRelation.findMany);
const declaredDeleteMany = vi.mocked(prisma.declaredRelation.deleteMany);
const ignoreFindMany = vi.mocked(prisma.relationSuggestionIgnore.findMany);
const ignoreUpsert = vi.mocked(prisma.relationSuggestionIgnore.upsert);
const ignoreDeleteMany = vi.mocked(prisma.relationSuggestionIgnore.deleteMany);

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";
const DATE = new Date("2026-10-22T00:00:00.000Z");
// Ids choisis pour que l'ordre lexicographique soit explicite (symetrie).
const SELYNE = "e-b-selyne";
const ALDRIC = "e-a-aldric";

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

function makeCustomRelationType(overrides: Partial<CustomRelationType> = {}): CustomRelationType {
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

// Le monde sert aussi les deux catalogues (meme findFirst, select imbrique) :
// une seule valeur, renvoyee a chaque appel.
function arrangeWorld(
  overrides: Partial<World> = {},
  customRelationTypes: CustomRelationType[] = [],
) {
  worldFindFirst.mockResolvedValue(
    Object.assign(makeWorld(overrides), { customRelationTypes, customEntityTypes: [] }),
  );
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: SELYNE,
    worldId: WORLD_ID,
    name: "Selyne",
    type: "character",
    customTypeId: null,
    content: {},
    plainText: "",
    seedRef: null,
    folderId: null,
    contentVersion: 0,
    scannedVersion: 0,
    createdAt: DATE,
    updatedAt: DATE,
    ...overrides,
  };
}

// getEntity (include aliases), puis l'autre entree du monde (select id).
function arrangeEntities(other: Entity | null = makeEntity({ id: ALDRIC, name: "Aldric" })) {
  entityFindFirst
    .mockResolvedValueOnce(Object.assign(makeEntity(), { aliases: [] }))
    .mockResolvedValueOnce(other);
}

function makeDeclared(overrides: Partial<DeclaredRelation> = {}): DeclaredRelation {
  return {
    id: "r1",
    worldId: WORLD_ID,
    sourceId: SELYNE,
    targetId: ALDRIC,
    relationType: "parent",
    customRelationTypeId: null,
    typeKey: "parent",
    createdAt: DATE,
    updatedAt: DATE,
    ...overrides,
  };
}

function makeRelation(overrides: Partial<Relation> = {}): Relation {
  return {
    id: "l1",
    worldId: WORLD_ID,
    sourceId: SELYNE,
    targetId: ALDRIC,
    origin: RelationOrigin.AUTO,
    createdAt: DATE,
    ...overrides,
  };
}

function makeIgnore(overrides: Partial<RelationSuggestionIgnore> = {}): RelationSuggestionIgnore {
  return {
    id: "i1",
    worldId: WORLD_ID,
    entityId: SELYNE,
    targetId: ALDRIC,
    createdAt: DATE,
    ...overrides,
  };
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("violation", { code, clientVersion: "test" });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createDeclaredRelation", () => {
  it("monde d'un autre proprietaire : introuvable, rien n'est ecrit", async () => {
    worldFindFirst.mockResolvedValue(null);
    await expect(
      createDeclaredRelation(OWNER_ID, WORLD_ID, SELYNE, ALDRIC, {
        key: "parent",
        viewpoint: "source",
      }),
    ).rejects.toThrow(WorldNotFoundError);
    expect(declaredCreate).not.toHaveBeenCalled();
  });

  it("autre entree hors du monde : introuvable (patron A01)", async () => {
    arrangeWorld();
    arrangeEntities(null);
    await expect(
      createDeclaredRelation(OWNER_ID, WORLD_ID, SELYNE, "e-autre-monde", {
        key: "parent",
        viewpoint: "source",
      }),
    ).rejects.toThrow(EntityNotFoundError);
    expect(entityFindFirst).toHaveBeenLastCalledWith({
      where: { id: "e-autre-monde", worldId: WORLD_ID },
      select: { id: true },
    });
  });

  it("source = cible : refusee", async () => {
    arrangeWorld();
    arrangeEntities(makeEntity());
    await expect(
      createDeclaredRelation(OWNER_ID, WORLD_ID, SELYNE, SELYNE, {
        key: "ally",
        viewpoint: "source",
      }),
    ).rejects.toThrow(SelfRelationError);
  });

  it("type natif masque dans le monde : refuse", async () => {
    arrangeWorld({ hiddenRelationTypes: ["parent"] });
    arrangeEntities();
    await expect(
      createDeclaredRelation(OWNER_ID, WORLD_ID, SELYNE, ALDRIC, {
        key: "parent",
        viewpoint: "source",
      }),
    ).rejects.toThrow(RelationTypeHiddenError);
  });

  it("type perso absent du monde : introuvable", async () => {
    arrangeWorld();
    arrangeEntities();
    await expect(
      createDeclaredRelation(OWNER_ID, WORLD_ID, SELYNE, ALDRIC, {
        key: "custom:rt-ailleurs",
        viewpoint: "source",
      }),
    ).rejects.toThrow(CustomRelationTypeNotFoundError);
  });

  it("dirige depuis la fiche source : fiche -> autre", async () => {
    arrangeWorld();
    arrangeEntities();
    declaredCreate.mockResolvedValueOnce(makeDeclared());

    await expect(
      createDeclaredRelation(OWNER_ID, WORLD_ID, SELYNE, ALDRIC, {
        key: "parent",
        viewpoint: "source",
      }),
    ).resolves.toEqual({ sourceId: SELYNE, targetId: ALDRIC });
    expect(declaredCreate).toHaveBeenCalledWith({
      data: {
        worldId: WORLD_ID,
        sourceId: SELYNE,
        targetId: ALDRIC,
        relationType: "parent",
        customRelationTypeId: null,
        typeKey: "parent",
      },
    });
  });

  it("« Vassal de » choisi sur la fiche : relation perso de l'autre vers la fiche", async () => {
    arrangeWorld({}, [makeCustomRelationType()]);
    arrangeEntities();
    declaredCreate.mockResolvedValueOnce(makeDeclared());

    await createDeclaredRelation(OWNER_ID, WORLD_ID, SELYNE, ALDRIC, {
      key: "custom:rt-suz",
      viewpoint: "target",
    });
    expect(declaredCreate).toHaveBeenCalledWith({
      data: {
        worldId: WORLD_ID,
        sourceId: ALDRIC,
        targetId: SELYNE,
        relationType: "custom",
        customRelationTypeId: "rt-suz",
        typeKey: "custom:rt-suz",
      },
    });
  });

  it("symetrique : paire ordonnee par id, quel que soit le sens de saisie", async () => {
    arrangeWorld();
    arrangeEntities();
    declaredCreate.mockResolvedValueOnce(makeDeclared());

    // SELYNE ("e-b-...") > ALDRIC ("e-a-...") : stockee ALDRIC -> SELYNE.
    await expect(
      createDeclaredRelation(OWNER_ID, WORLD_ID, SELYNE, ALDRIC, {
        key: "ally",
        viewpoint: "source",
      }),
    ).resolves.toEqual({ sourceId: ALDRIC, targetId: SELYNE });
  });

  it("A<->B cree deux fois (P2002) : « Cette relation existe deja », cause chainee", async () => {
    arrangeWorld();
    arrangeEntities();
    const cause = prismaError("P2002");
    declaredCreate.mockRejectedValueOnce(cause);

    const error = await createDeclaredRelation(OWNER_ID, WORLD_ID, SELYNE, ALDRIC, {
      key: "ally",
      viewpoint: "source",
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DeclaredRelationDuplicateError);
    expect(error).toMatchObject({ message: "Cette relation existe déjà.", cause });
  });
});

describe("deleteDeclaredRelation", () => {
  it("relation d'un autre monde : introuvable, rien n'est supprime", async () => {
    arrangeWorld();
    declaredFindFirst.mockResolvedValueOnce(null);
    await expect(deleteDeclaredRelation(OWNER_ID, WORLD_ID, "r-ailleurs")).rejects.toThrow(
      DeclaredRelationNotFoundError,
    );
    expect(declaredDeleteMany).not.toHaveBeenCalled();
  });

  it("supprime dans le monde et rend les deux extremites (revalidation)", async () => {
    arrangeWorld();
    declaredFindFirst.mockResolvedValueOnce(makeDeclared());
    declaredDeleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(deleteDeclaredRelation(OWNER_ID, WORLD_ID, "r1")).resolves.toMatchObject({
      sourceId: SELYNE,
      targetId: ALDRIC,
    });
    expect(declaredDeleteMany).toHaveBeenCalledWith({ where: { id: "r1", worldId: WORLD_ID } });
  });
});

describe("listDeclaredRelationsForEntity", () => {
  const PARENT = Object.assign(makeDeclared(), {
    source: { id: SELYNE, name: "Selyne" },
    target: { id: ALDRIC, name: "Aldric" },
  });

  it("depuis la source : « Parent de » Aldric, sans champ de type brut", async () => {
    arrangeWorld();
    entityFindFirst.mockResolvedValueOnce(Object.assign(makeEntity(), { aliases: [] }));
    declaredFindMany.mockResolvedValueOnce([PARENT]);

    const [view] = await listDeclaredRelationsForEntity(OWNER_ID, WORLD_ID, SELYNE);
    expect(view).toMatchObject({
      id: "r1",
      other: { id: ALDRIC, name: "Aldric" },
      viewpoint: "source",
      label: "Parent de",
    });
    expect(view).not.toHaveProperty("customRelationTypeId");
    expect(view).not.toHaveProperty("relationType.relationType");
  });

  it("depuis la cible : « Enfant de » Selyne", async () => {
    arrangeWorld();
    entityFindFirst.mockResolvedValueOnce(
      Object.assign(makeEntity({ id: ALDRIC, name: "Aldric" }), { aliases: [] }),
    );
    declaredFindMany.mockResolvedValueOnce([PARENT]);

    const [view] = await listDeclaredRelationsForEntity(OWNER_ID, WORLD_ID, ALDRIC);
    expect(view).toMatchObject({
      other: { id: SELYNE, name: "Selyne" },
      viewpoint: "target",
      label: "Enfant de",
    });
  });
});

describe("listWorldDeclaredRelations", () => {
  it("rend les relations du monde, type resolu", async () => {
    arrangeWorld();
    declaredFindMany.mockResolvedValueOnce([makeDeclared()]);
    await expect(listWorldDeclaredRelations(OWNER_ID, WORLD_ID)).resolves.toEqual([
      {
        sourceId: SELYNE,
        targetId: ALDRIC,
        relationType: expect.objectContaining({ key: "parent", label: "Parent de" }),
      },
    ]);
  });
});

describe("listRelationSuggestions", () => {
  it("entrees citees (AUTO + MANUAL, sans doublon) sans relation declaree ni ignorees", async () => {
    arrangeWorld();
    entityFindFirst.mockResolvedValueOnce(Object.assign(makeEntity(), { aliases: [] }));
    relationFindMany.mockResolvedValueOnce([
      makeRelation({ targetId: "e-port" }),
      makeRelation({ targetId: "e-port", origin: RelationOrigin.MANUAL }),
      makeRelation({ targetId: ALDRIC }),
      makeRelation({ targetId: "e-mira" }),
      makeRelation({ targetId: "e-ignoree" }),
    ]);
    // Relation declaree dans l'AUTRE sens (Mira -> Selyne) : exclut aussi.
    declaredFindMany.mockResolvedValueOnce([
      makeDeclared({ sourceId: SELYNE, targetId: ALDRIC }),
      makeDeclared({ sourceId: "e-mira", targetId: SELYNE }),
    ]);
    ignoreFindMany.mockResolvedValueOnce([makeIgnore({ targetId: "e-ignoree" })]);
    entityFindMany.mockResolvedValueOnce([
      makeEntity({ id: "e-port", name: "Port-Brume", type: "place" }),
    ]);

    await expect(listRelationSuggestions(OWNER_ID, WORLD_ID, SELYNE)).resolves.toEqual([
      { id: "e-port", name: "Port-Brume", preselected: "located|source" },
    ]);
    expect(entityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["e-port"] }, worldId: WORLD_ID } }),
    );
  });

  it("aucune citation : liste vide sans lire les entrees", async () => {
    arrangeWorld();
    entityFindFirst.mockResolvedValueOnce(Object.assign(makeEntity(), { aliases: [] }));
    relationFindMany.mockResolvedValueOnce([]);
    declaredFindMany.mockResolvedValueOnce([]);
    ignoreFindMany.mockResolvedValueOnce([]);

    await expect(listRelationSuggestions(OWNER_ID, WORLD_ID, SELYNE)).resolves.toEqual([]);
    expect(entityFindMany).not.toHaveBeenCalled();
  });
});

describe("suggestions ignorees", () => {
  it("ignorer une entree d'un autre monde : introuvable", async () => {
    arrangeWorld();
    arrangeEntities(null);
    await expect(
      ignoreRelationSuggestion(OWNER_ID, WORLD_ID, SELYNE, "e-autre-monde"),
    ).rejects.toThrow(EntityNotFoundError);
    expect(ignoreUpsert).not.toHaveBeenCalled();
  });

  it("ignorer : upsert idempotent", async () => {
    arrangeWorld();
    arrangeEntities();
    await ignoreRelationSuggestion(OWNER_ID, WORLD_ID, SELYNE, ALDRIC);
    expect(ignoreUpsert).toHaveBeenCalledWith({
      where: { entityId_targetId: { entityId: SELYNE, targetId: ALDRIC } },
      create: { worldId: WORLD_ID, entityId: SELYNE, targetId: ALDRIC },
      update: {},
    });
  });

  it("ne plus ignorer : supprime la ligne de la fiche", async () => {
    arrangeWorld();
    entityFindFirst.mockResolvedValueOnce(Object.assign(makeEntity(), { aliases: [] }));
    await unignoreRelationSuggestion(OWNER_ID, WORLD_ID, SELYNE, ALDRIC);
    expect(ignoreDeleteMany).toHaveBeenCalledWith({
      where: { entityId: SELYNE, targetId: ALDRIC },
    });
  });

  it("liste les suggestions ignorees, triees par nom", async () => {
    arrangeWorld();
    entityFindFirst.mockResolvedValueOnce(Object.assign(makeEntity(), { aliases: [] }));
    ignoreFindMany.mockResolvedValueOnce([
      Object.assign(makeIgnore(), { target: { id: "e-z", name: "Zélie" } }),
      Object.assign(makeIgnore({ id: "i2" }), { target: { id: ALDRIC, name: "Aldric" } }),
    ]);
    await expect(listIgnoredRelationSuggestions(OWNER_ID, WORLD_ID, SELYNE)).resolves.toEqual([
      { id: ALDRIC, name: "Aldric" },
      { id: "e-z", name: "Zélie" },
    ]);
  });
});
