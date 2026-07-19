import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { Alias, Entity, World } from "@/generated/prisma/client";
import { AliasSource, WorldOrigin } from "@/generated/prisma/client";
import { EMPTY_CONTENT } from "@/lib/tiptap-content";
import { normalizeForMatch } from "@/lib/linker/normalize";
import { WorldNotFoundError } from "./world-service";
import {
  EntityNotFoundError,
  EntityQuotaExceededError,
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  searchEntities,
  updateEntity,
  updateEntityContent,
} from "./entity-service";

// Meme regle que world-service.test.ts : Prisma mocke, aucune connexion reelle.
// getWorld() (world-service) n'est pas mocke - on verifie la vraie cascade
// d'autorisation monde -> entite en laissant le mock Prisma piloter les deux.
vi.mock("@/db/client", () => ({
  prisma: {
    world: {
      findFirst: vi.fn(),
    },
    entity: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const worldFindFirst = vi.mocked(prisma.world.findFirst);
const entityFindFirst = vi.mocked(prisma.entity.findFirst);
const entityFindMany = vi.mocked(prisma.entity.findMany);
const entityCount = vi.mocked(prisma.entity.count);
const entityCreate = vi.mocked(prisma.entity.create);
const entityUpdate = vi.mocked(prisma.entity.update);
const entityDelete = vi.mocked(prisma.entity.delete);

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";

function makeWorld(overrides: Partial<World> = {}): World {
  return {
    id: WORLD_ID,
    ownerId: OWNER_ID,
    name: "Eldoria",
    slug: "eldoria",
    origin: WorldOrigin.USER,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeAlias(overrides: Partial<Alias> = {}): Alias {
  return {
    id: "a1",
    entityId: "e1",
    value: "La Reine",
    normalized: normalizeForMatch("La Reine"),
    active: true,
    source: AliasSource.MANUAL,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeEntity(
  overrides: Partial<Entity> & { aliases?: Alias[] } = {},
): Entity & { aliases: Alias[] } {
  const { aliases = [], ...entityOverrides } = overrides;
  return {
    id: "e1",
    worldId: WORLD_ID,
    name: "Aeliana",
    type: "character",
    content: EMPTY_CONTENT,
    plainText: "",
    seedRef: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...entityOverrides,
    aliases,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createEntity", () => {
  it("cree l'entite avec un contenu vide par defaut quand le monde appartient au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityCount.mockResolvedValueOnce(0);
    entityCreate.mockResolvedValueOnce(makeEntity({ aliases: [makeAlias({ value: "La Reine" })] }));

    const entity = await createEntity(OWNER_ID, WORLD_ID, {
      name: "Aeliana",
      type: "character",
      aliases: ["La Reine"],
    });

    expect(entityCount).toHaveBeenCalledWith({ where: { worldId: WORLD_ID } });
    expect(entityCreate).toHaveBeenCalledWith({
      data: {
        worldId: WORLD_ID,
        name: "Aeliana",
        type: "character",
        aliases: { create: [{ value: "La Reine", normalized: normalizeForMatch("La Reine") }] },
        content: EMPTY_CONTENT,
        plainText: "",
      },
      include: { aliases: true },
    });
    expect(entity.name).toBe("Aeliana");
    expect(entity.aliases).toEqual(["La Reine"]);
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire, sans creer l'entite", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(
      createEntity(OWNER_ID, WORLD_ID, { name: "Aeliana", type: "character", aliases: [] }),
    ).rejects.toThrow(WorldNotFoundError);
    expect(entityCreate).not.toHaveBeenCalled();
  });

  it("autorise la creation juste sous la limite (49 fiches existantes)", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityCount.mockResolvedValueOnce(49);
    entityCreate.mockResolvedValueOnce(makeEntity());

    await createEntity(OWNER_ID, WORLD_ID, { name: "Aeliana", type: "character", aliases: [] });

    expect(entityCreate).toHaveBeenCalled();
  });

  it("leve EntityQuotaExceededError a la limite (50 fiches existantes), sans creer", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityCount.mockResolvedValueOnce(50);

    await expect(
      createEntity(OWNER_ID, WORLD_ID, { name: "Aeliana", type: "character", aliases: [] }),
    ).rejects.toThrow(EntityQuotaExceededError);
    expect(entityCreate).not.toHaveBeenCalled();
  });

  it("saute le controle de quota pour un monde origin=INTRO, meme au-dela de la limite", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ origin: WorldOrigin.INTRO }));
    entityCreate.mockResolvedValueOnce(makeEntity());

    await createEntity(OWNER_ID, WORLD_ID, { name: "Aeliana", type: "character", aliases: [] });

    expect(entityCount).not.toHaveBeenCalled();
    expect(entityCreate).toHaveBeenCalled();
  });

  it("saute le controle de quota pour un monde origin=DEMO, meme au-dela de la limite", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ origin: WorldOrigin.DEMO }));
    entityCreate.mockResolvedValueOnce(makeEntity());

    await createEntity(OWNER_ID, WORLD_ID, { name: "Aeliana", type: "character", aliases: [] });

    expect(entityCount).not.toHaveBeenCalled();
    expect(entityCreate).toHaveBeenCalled();
  });
});

describe("listEntities", () => {
  it("liste les entites du monde quand il appartient au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([
      makeEntity({ id: "e1", aliases: [makeAlias({ value: "La Reine" })] }),
    ]);

    const entities = await listEntities(OWNER_ID, WORLD_ID);

    expect(entityFindMany).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID },
      include: { aliases: true },
      orderBy: { createdAt: "desc" },
    });
    expect(entities[0]?.aliases).toEqual(["La Reine"]);
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(listEntities(OWNER_ID, WORLD_ID)).rejects.toThrow(WorldNotFoundError);
    expect(entityFindMany).not.toHaveBeenCalled();
  });
});

describe("searchEntities", () => {
  it("trouve les entites par nom, insensible a la casse", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([
      makeEntity({ id: "e1", name: "Aeliana" }),
      makeEntity({ id: "e2", name: "Bram" }),
    ]);

    const results = await searchEntities(OWNER_ID, WORLD_ID, "AELIANA");

    expect(results).toEqual([{ id: "e1", name: "Aeliana", type: "character" }]);
    expect(entityFindMany).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID },
      select: {
        id: true,
        name: true,
        type: true,
        aliases: { select: { normalized: true }, where: { active: true } },
      },
      orderBy: { name: "asc" },
    });
  });

  it("trouve les entites par alias quand le nom ne correspond pas, insensible a la casse", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([
      makeEntity({
        id: "e1",
        name: "Néron",
        aliases: [makeAlias({ value: "Le Tyran", normalized: normalizeForMatch("Le Tyran") })],
      }),
      makeEntity({ id: "e2", name: "Bram" }),
    ]);

    const results = await searchEntities(OWNER_ID, WORLD_ID, "TYRAN");

    expect(results).toEqual([{ id: "e1", name: "Néron", type: "character" }]);
  });

  it("trouve les entites par nom, insensible aux accents", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([
      makeEntity({ id: "e1", name: "Néron" }),
      makeEntity({ id: "e2", name: "Bram" }),
    ]);

    const results = await searchEntities(OWNER_ID, WORLD_ID, "neron");

    expect(results).toEqual([{ id: "e1", name: "Néron", type: "character" }]);
  });

  it("ne renvoie pas aliases dans la projection", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([
      makeEntity({ id: "e1", aliases: [makeAlias({ value: "La Reine" })] }),
    ]);

    const results = await searchEntities(OWNER_ID, WORLD_ID, "Aeliana");

    expect(results).toEqual([{ id: "e1", name: "Aeliana", type: "character" }]);
  });

  it("renvoie un tableau vide si aucune fiche ne correspond", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([makeEntity({ id: "e1", name: "Aeliana" })]);

    const results = await searchEntities(OWNER_ID, WORLD_ID, "Zorglub");

    expect(results).toEqual([]);
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire, sans interroger les entites", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(searchEntities(OWNER_ID, WORLD_ID, "Aeliana")).rejects.toThrow(WorldNotFoundError);
    expect(entityFindMany).not.toHaveBeenCalled();
  });
});

describe("getEntity", () => {
  it("retourne l'entite si le monde et l'entite appartiennent au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindFirst.mockResolvedValueOnce(makeEntity());

    const entity = await getEntity(OWNER_ID, WORLD_ID, "e1");

    expect(entity.id).toBe("e1");
    expect(entityFindFirst).toHaveBeenCalledWith({
      where: { id: "e1", worldId: WORLD_ID },
      include: { aliases: true },
    });
  });

  it("leve EntityNotFoundError si l'entite n'existe pas dans ce monde", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindFirst.mockResolvedValueOnce(null);

    await expect(getEntity(OWNER_ID, WORLD_ID, "unknown")).rejects.toThrow(EntityNotFoundError);
  });

  it("leve WorldNotFoundError avant meme de chercher l'entite si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(getEntity(OWNER_ID, WORLD_ID, "e1")).rejects.toThrow(WorldNotFoundError);
    expect(entityFindFirst).not.toHaveBeenCalled();
  });
});

describe("updateEntity", () => {
  it("met a jour le nom, le type et remplace entierement les aliases", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindFirst.mockResolvedValueOnce(makeEntity());
    entityUpdate.mockResolvedValueOnce(
      makeEntity({
        name: "Aeliana la Grise",
        type: "place",
        aliases: [makeAlias({ value: "La Grise" })],
      }),
    );

    const entity = await updateEntity(OWNER_ID, WORLD_ID, "e1", {
      name: "Aeliana la Grise",
      type: "place",
      aliases: ["La Grise"],
    });

    expect(entityUpdate).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: {
        name: "Aeliana la Grise",
        type: "place",
        aliases: {
          deleteMany: {},
          create: [{ value: "La Grise", normalized: normalizeForMatch("La Grise") }],
        },
      },
      include: { aliases: true },
    });
    expect(entity.name).toBe("Aeliana la Grise");
    expect(entity.aliases).toEqual(["La Grise"]);
  });

  it("leve EntityNotFoundError et ne met rien a jour si l'entite n'appartient pas a ce monde", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindFirst.mockResolvedValueOnce(null);

    await expect(
      updateEntity(OWNER_ID, WORLD_ID, "e1", { name: "X", type: "character", aliases: [] }),
    ).rejects.toThrow(EntityNotFoundError);
    expect(entityUpdate).not.toHaveBeenCalled();
  });
});

describe("updateEntityContent", () => {
  it("persiste le contenu et le plainText deja extraits", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindFirst.mockResolvedValueOnce(makeEntity());
    const newContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Salut" }] }],
    };
    entityUpdate.mockResolvedValueOnce(makeEntity({ content: newContent, plainText: "Salut" }));

    const entity = await updateEntityContent(OWNER_ID, WORLD_ID, "e1", newContent, "Salut");

    expect(entityUpdate).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { content: newContent, plainText: "Salut" },
      include: { aliases: true },
    });
    expect(entity.plainText).toBe("Salut");
  });

  it("leve EntityNotFoundError et ne met rien a jour si l'entite n'appartient pas a ce monde", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindFirst.mockResolvedValueOnce(null);

    await expect(updateEntityContent(OWNER_ID, WORLD_ID, "e1", EMPTY_CONTENT, "")).rejects.toThrow(
      EntityNotFoundError,
    );
    expect(entityUpdate).not.toHaveBeenCalled();
  });
});

describe("deleteEntity", () => {
  it("supprime l'entite si elle appartient au monde du proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindFirst.mockResolvedValueOnce(makeEntity());

    await deleteEntity(OWNER_ID, WORLD_ID, "e1");

    expect(entityDelete).toHaveBeenCalledWith({ where: { id: "e1" } });
  });

  it("leve EntityNotFoundError et ne supprime rien si l'entite n'existe pas dans ce monde", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindFirst.mockResolvedValueOnce(null);

    await expect(deleteEntity(OWNER_ID, WORLD_ID, "e1")).rejects.toThrow(EntityNotFoundError);
    expect(entityDelete).not.toHaveBeenCalled();
  });
});
