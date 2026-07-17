import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { Entity, LinkIgnore, Relation, World } from "@/generated/prisma/client";
import { RelationOrigin } from "@/generated/prisma/client";
import { EMPTY_CONTENT } from "@/lib/tiptap-content";
import { WorldNotFoundError } from "./world-service";
import { getIgnoredTargetIds, listIncomingLinks, listOutgoingLinks } from "./relation-service";

// Meme regle que entity-service.test.ts : Prisma mocke, getWorld() n'est pas
// mocke - on verifie la vraie cascade d'autorisation monde -> LinkIgnore/Relation
// en laissant le mock Prisma piloter les deux.
vi.mock("@/db/client", () => ({
  prisma: {
    world: {
      findFirst: vi.fn(),
    },
    linkIgnore: {
      findMany: vi.fn(),
    },
    relation: {
      findMany: vi.fn(),
    },
    entity: {
      findMany: vi.fn(),
    },
  },
}));

const worldFindFirst = vi.mocked(prisma.world.findFirst);
const linkIgnoreFindMany = vi.mocked(prisma.linkIgnore.findMany);
const relationFindMany = vi.mocked(prisma.relation.findMany);
const entityFindMany = vi.mocked(prisma.entity.findMany);

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";
const ENTITY_ID = "e1";

function makeWorld(overrides: Partial<World> = {}): World {
  return {
    id: WORLD_ID,
    ownerId: OWNER_ID,
    name: "Eldoria",
    slug: "eldoria",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Objet complet malgre le `select` reel de getIgnoredTargetIds (targetId
// seul) - meme convention que linker-service.test.ts.
function makeLinkIgnore(overrides: Partial<LinkIgnore> = {}): LinkIgnore {
  return {
    id: "li1",
    worldId: WORLD_ID,
    entityId: ENTITY_ID,
    targetId: "e2",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Objets complets malgre les selects plats de listOutgoingLinks (meme
// convention - skill prisma-mock-partial-select).
function makeRelation(overrides: Partial<Relation> = {}): Relation {
  return {
    id: "r1",
    worldId: WORLD_ID,
    sourceId: ENTITY_ID,
    targetId: "e2",
    origin: RelationOrigin.AUTO,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "e2",
    worldId: WORLD_ID,
    name: "Aeliana",
    type: "character",
    aliases: [],
    content: EMPTY_CONTENT,
    plainText: "",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("getIgnoredTargetIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(getIgnoredTargetIds(OWNER_ID, WORLD_ID, ENTITY_ID)).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(linkIgnoreFindMany).not.toHaveBeenCalled();
  });

  it("retourne un tableau vide sans LinkIgnore", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    linkIgnoreFindMany.mockResolvedValue([]);

    const result = await getIgnoredTargetIds(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([]);
    expect(linkIgnoreFindMany).toHaveBeenCalledWith({
      where: { entityId: ENTITY_ID },
      select: { targetId: true },
    });
  });

  it("retourne les targetId ignores pour cette entite", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    linkIgnoreFindMany.mockResolvedValue([
      makeLinkIgnore({ targetId: "e2" }),
      makeLinkIgnore({ targetId: "e3" }),
    ]);

    const result = await getIgnoredTargetIds(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual(["e2", "e3"]);
  });
});

describe("listOutgoingLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(listOutgoingLinks(OWNER_ID, WORLD_ID, ENTITY_ID)).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(relationFindMany).not.toHaveBeenCalled();
  });

  it("retourne un tableau vide sans relation sortante (sans requeter les entites)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    relationFindMany.mockResolvedValue([]);

    const result = await listOutgoingLinks(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([]);
    expect(entityFindMany).not.toHaveBeenCalled();
  });

  it("retourne les entites liees (AUTO et MANUAL confondues), triees par nom", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    relationFindMany.mockResolvedValue([
      makeRelation({ targetId: "e2", origin: RelationOrigin.AUTO }),
      makeRelation({ targetId: "e3", origin: RelationOrigin.MANUAL }),
    ]);
    entityFindMany.mockResolvedValue([
      makeEntity({ id: "e2", name: "Robert" }),
      makeEntity({ id: "e3", name: "Aeliana" }),
    ]);

    const result = await listOutgoingLinks(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([
      { id: "e3", name: "Aeliana", origin: RelationOrigin.MANUAL },
      { id: "e2", name: "Robert", origin: RelationOrigin.AUTO },
    ]);
    expect(entityFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["e2", "e3"] } },
      select: { id: true, name: true },
    });
  });

  it("omet silencieusement une cible introuvable (supprimee entre les deux requetes)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    relationFindMany.mockResolvedValue([makeRelation({ targetId: "e2" })]);
    entityFindMany.mockResolvedValue([]);

    const result = await listOutgoingLinks(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([]);
  });
});

describe("listIncomingLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(listIncomingLinks(OWNER_ID, WORLD_ID, ENTITY_ID)).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(relationFindMany).not.toHaveBeenCalled();
  });

  it("retourne un tableau vide sans relation entrante (sans requeter les entites)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    relationFindMany.mockResolvedValue([]);

    const result = await listIncomingLinks(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([]);
    expect(entityFindMany).not.toHaveBeenCalled();
    expect(relationFindMany).toHaveBeenCalledWith({
      where: { targetId: ENTITY_ID },
      select: { sourceId: true, origin: true },
    });
  });

  it("retourne les entites source (AUTO et MANUAL confondues), triees par nom", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    relationFindMany.mockResolvedValue([
      makeRelation({ sourceId: "e2", origin: RelationOrigin.AUTO }),
      makeRelation({ sourceId: "e3", origin: RelationOrigin.MANUAL }),
    ]);
    entityFindMany.mockResolvedValue([
      makeEntity({ id: "e2", name: "Robert" }),
      makeEntity({ id: "e3", name: "Aeliana" }),
    ]);

    const result = await listIncomingLinks(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([
      { id: "e3", name: "Aeliana", origin: RelationOrigin.MANUAL },
      { id: "e2", name: "Robert", origin: RelationOrigin.AUTO },
    ]);
    expect(entityFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["e2", "e3"] } },
      select: { id: true, name: true },
    });
  });

  it("omet silencieusement une source introuvable (supprimee entre les deux requetes)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    relationFindMany.mockResolvedValue([makeRelation({ sourceId: "e2" })]);
    entityFindMany.mockResolvedValue([]);

    const result = await listIncomingLinks(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([]);
  });
});
