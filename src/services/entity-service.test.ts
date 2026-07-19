import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { Entity, World } from "@/generated/prisma/client";
import { EMPTY_CONTENT } from "@/lib/tiptap-content";
import { WorldNotFoundError } from "./world-service";
import {
  EntityNotFoundError,
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
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const worldFindFirst = vi.mocked(prisma.world.findFirst);
const entityFindFirst = vi.mocked(prisma.entity.findFirst);
const entityFindMany = vi.mocked(prisma.entity.findMany);
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
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "e1",
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createEntity", () => {
  it("cree l'entite avec un contenu vide par defaut quand le monde appartient au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityCreate.mockResolvedValueOnce(makeEntity());

    const entity = await createEntity(OWNER_ID, WORLD_ID, {
      name: "Aeliana",
      type: "character",
      aliases: ["La Reine"],
    });

    expect(entityCreate).toHaveBeenCalledWith({
      data: {
        worldId: WORLD_ID,
        name: "Aeliana",
        type: "character",
        aliases: ["La Reine"],
        content: EMPTY_CONTENT,
        plainText: "",
      },
    });
    expect(entity.name).toBe("Aeliana");
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire, sans creer l'entite", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(
      createEntity(OWNER_ID, WORLD_ID, { name: "Aeliana", type: "character", aliases: [] }),
    ).rejects.toThrow(WorldNotFoundError);
    expect(entityCreate).not.toHaveBeenCalled();
  });
});

describe("listEntities", () => {
  it("liste les entites du monde quand il appartient au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([]);

    await listEntities(OWNER_ID, WORLD_ID);

    expect(entityFindMany).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID },
      orderBy: { createdAt: "desc" },
    });
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
      makeEntity({ id: "e1", name: "Aeliana", aliases: [] }),
      makeEntity({ id: "e2", name: "Bram", aliases: [] }),
    ]);

    const results = await searchEntities(OWNER_ID, WORLD_ID, "AELIANA");

    expect(results).toEqual([{ id: "e1", name: "Aeliana", type: "character" }]);
    expect(entityFindMany).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID },
      select: { id: true, name: true, type: true, aliases: true },
      orderBy: { name: "asc" },
    });
  });

  it("trouve les entites par alias quand le nom ne correspond pas, insensible a la casse", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([
      makeEntity({ id: "e1", name: "Néron", aliases: ["Le Tyran"] }),
      makeEntity({ id: "e2", name: "Bram", aliases: [] }),
    ]);

    const results = await searchEntities(OWNER_ID, WORLD_ID, "TYRAN");

    expect(results).toEqual([{ id: "e1", name: "Néron", type: "character" }]);
  });

  it("trouve les entites par nom, insensible aux accents", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([
      makeEntity({ id: "e1", name: "Néron", aliases: [] }),
      makeEntity({ id: "e2", name: "Bram", aliases: [] }),
    ]);

    const results = await searchEntities(OWNER_ID, WORLD_ID, "neron");

    expect(results).toEqual([{ id: "e1", name: "Néron", type: "character" }]);
  });

  it("ne renvoie pas aliases dans la projection", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([makeEntity({ id: "e1", aliases: ["La Reine"] })]);

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
    expect(entityFindFirst).toHaveBeenCalledWith({ where: { id: "e1", worldId: WORLD_ID } });
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
  it("met a jour le nom, le type et les aliases", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindFirst.mockResolvedValueOnce(makeEntity());
    entityUpdate.mockResolvedValueOnce(
      makeEntity({ name: "Aeliana la Grise", type: "place", aliases: ["La Grise"] }),
    );

    const entity = await updateEntity(OWNER_ID, WORLD_ID, "e1", {
      name: "Aeliana la Grise",
      type: "place",
      aliases: ["La Grise"],
    });

    expect(entityUpdate).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { name: "Aeliana la Grise", type: "place", aliases: ["La Grise"] },
    });
    expect(entity.name).toBe("Aeliana la Grise");
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
