import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { Alias, Entity, LinkIgnore, Relation, World } from "@/generated/prisma/client";
import { RelationOrigin, WorldOrigin } from "@/generated/prisma/client";
import { EMPTY_CONTENT } from "@/lib/tiptap-content";
import { WorldNotFoundError } from "./world-service";
import {
  getIgnoredTargetIds,
  ignoreLink,
  listIgnoredTargets,
  listIncomingLinks,
  listOutgoingLinks,
  listWorldRelations,
  reconcileManualMentions,
  unignoreLink,
} from "./relation-service";
import { EntityNotFoundError } from "./entity-service";

// Meme regle que entity-service.test.ts : Prisma mocke, getWorld()/getEntity()
// ne sont pas mockes - on verifie la vraie cascade d'autorisation monde ->
// entite -> LinkIgnore/Relation en laissant le mock Prisma piloter les trois.
vi.mock("@/db/client", () => ({
  prisma: {
    world: {
      findFirst: vi.fn(),
    },
    linkIgnore: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    relation: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    entity: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const worldFindFirst = vi.mocked(prisma.world.findFirst);
const linkIgnoreFindMany = vi.mocked(prisma.linkIgnore.findMany);
const linkIgnoreUpsert = vi.mocked(prisma.linkIgnore.upsert);
const linkIgnoreDeleteMany = vi.mocked(prisma.linkIgnore.deleteMany);
const relationFindMany = vi.mocked(prisma.relation.findMany);
const relationCreateMany = vi.mocked(prisma.relation.createMany);
const relationDeleteMany = vi.mocked(prisma.relation.deleteMany);
const entityFindFirst = vi.mocked(prisma.entity.findFirst);
const entityFindMany = vi.mocked(prisma.entity.findMany);
const transaction = vi.mocked(prisma.$transaction);

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";
const ENTITY_ID = "e1";

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

// aliases: [] par defaut - entity-service.ts.getEntity() (appele en cascade
// par relation-service.ts) fait toujours include:{aliases:true} et aplatit
// via toEntityRecord, le mock doit donc fournir le tableau meme si ce fichier
// n'en verifie jamais le contenu.
function makeEntity(overrides: Partial<Entity> & { aliases?: Alias[] } = {}): Entity & {
  aliases: Alias[];
} {
  const { aliases = [], ...entityOverrides } = overrides;
  return {
    id: "e2",
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

describe("listWorldRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(listWorldRelations(OWNER_ID, WORLD_ID)).rejects.toThrow(WorldNotFoundError);
    expect(relationFindMany).not.toHaveBeenCalled();
  });

  it("retourne toutes les relations du monde, select plat (sourceId/targetId/origin)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    const relations = [
      makeRelation({ sourceId: "e1", targetId: "e2", origin: RelationOrigin.AUTO }),
      makeRelation({ sourceId: "e2", targetId: "e3", origin: RelationOrigin.MANUAL }),
    ];
    relationFindMany.mockResolvedValue(relations);

    const result = await listWorldRelations(OWNER_ID, WORLD_ID);

    // listWorldRelations retransmet tel quel ce que Prisma renvoie (pas de
    // reshaping comme listOutgoingLinks/listIncomingLinks) - le `select` reel
    // est ce qui garantit la forme {sourceId,targetId,origin} en production,
    // verifie ci-dessous via l'appel exact ; le mock complet (convention
    // prisma-mock-partial-select) sert uniquement a satisfaire le typage.
    expect(result).toEqual(relations);
    expect(relationFindMany).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID },
      select: { sourceId: true, targetId: true, origin: true },
    });
  });

  it("retourne un tableau vide sans relation dans le monde", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    relationFindMany.mockResolvedValue([]);

    const result = await listWorldRelations(OWNER_ID, WORLD_ID);

    expect(result).toEqual([]);
  });
});

describe("reconcileManualMentions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    relationFindMany.mockResolvedValue([]);
    entityFindMany.mockResolvedValue([]);
    transaction.mockResolvedValue([]);
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(reconcileManualMentions(OWNER_ID, WORLD_ID, ENTITY_ID, ["e2"])).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(entityFindMany).not.toHaveBeenCalled();
  });

  it("ne fait rien sans mention et sans Relation MANUAL existante", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());

    await reconcileManualMentions(OWNER_ID, WORLD_ID, ENTITY_ID, []);

    expect(entityFindMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("ajoute une Relation MANUAL pour une mention valide du monde", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    entityFindMany.mockResolvedValue([makeEntity({ id: "e2" })]);

    await reconcileManualMentions(OWNER_ID, WORLD_ID, ENTITY_ID, ["e2"]);

    expect(entityFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["e2"] }, worldId: WORLD_ID },
      select: { id: true },
    });
    expect(relationCreateMany).toHaveBeenCalledWith({
      data: [
        { worldId: WORLD_ID, sourceId: ENTITY_ID, targetId: "e2", origin: RelationOrigin.MANUAL },
      ],
      skipDuplicates: true,
    });
    expect(relationDeleteMany).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("supprime une Relation MANUAL dont la mention a disparu du contenu", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    relationFindMany.mockResolvedValue([
      makeRelation({ sourceId: ENTITY_ID, targetId: "e2", origin: RelationOrigin.MANUAL }),
    ]);

    await reconcileManualMentions(OWNER_ID, WORLD_ID, ENTITY_ID, []);

    expect(relationDeleteMany).toHaveBeenCalledWith({
      where: { sourceId: ENTITY_ID, origin: RelationOrigin.MANUAL, targetId: { in: ["e2"] } },
    });
    expect(relationCreateMany).not.toHaveBeenCalled();
  });

  it("ignore silencieusement un id mentionne qui n'appartient pas au monde (jamais de confiance dans l'input client)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    entityFindMany.mockResolvedValue([]); // aucune entite ne correspond dans CE monde

    await reconcileManualMentions(OWNER_ID, WORLD_ID, ENTITY_ID, ["entite-d-un-autre-monde"]);

    expect(relationCreateMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("exclut l'auto-mention (une fiche qui se mentionnerait elle-meme)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());

    await reconcileManualMentions(OWNER_ID, WORLD_ID, ENTITY_ID, [ENTITY_ID]);

    expect(entityFindMany).not.toHaveBeenCalled();
    expect(relationCreateMany).not.toHaveBeenCalled();
  });

  it("deduplique les id mentionnes plusieurs fois avant de requeter", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    entityFindMany.mockResolvedValue([makeEntity({ id: "e2" })]);

    await reconcileManualMentions(OWNER_ID, WORLD_ID, ENTITY_ID, ["e2", "e2"]);

    expect(entityFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["e2"] }, worldId: WORLD_ID },
      select: { id: true },
    });
  });

  it("ne lit et n'ecrit jamais les relations AUTO (filtre origin=MANUAL explicite)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    relationFindMany.mockResolvedValue([
      makeRelation({ sourceId: ENTITY_ID, targetId: "e2", origin: RelationOrigin.MANUAL }),
    ]);

    await reconcileManualMentions(OWNER_ID, WORLD_ID, ENTITY_ID, []);

    expect(relationFindMany).toHaveBeenCalledWith({
      where: { sourceId: ENTITY_ID, origin: RelationOrigin.MANUAL },
      select: { targetId: true },
    });
    expect(relationDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ origin: RelationOrigin.MANUAL }),
      }),
    );
  });
});

describe("listIgnoredTargets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldFindFirst.mockResolvedValue(makeWorld());
    entityFindFirst.mockResolvedValue(makeEntity({ id: ENTITY_ID }));
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(listIgnoredTargets(OWNER_ID, WORLD_ID, ENTITY_ID)).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(linkIgnoreFindMany).not.toHaveBeenCalled();
  });

  it("leve EntityNotFoundError si l'entite n'appartient pas a ce monde", async () => {
    entityFindFirst.mockResolvedValue(null);

    await expect(listIgnoredTargets(OWNER_ID, WORLD_ID, ENTITY_ID)).rejects.toThrow(
      EntityNotFoundError,
    );
    expect(linkIgnoreFindMany).not.toHaveBeenCalled();
  });

  it("retourne un tableau vide sans cible ignoree (sans requeter les entites)", async () => {
    linkIgnoreFindMany.mockResolvedValue([]);

    const result = await listIgnoredTargets(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([]);
    expect(entityFindMany).not.toHaveBeenCalled();
  });

  it("retourne les cibles ignorees avec leur nom resolu, triees", async () => {
    linkIgnoreFindMany.mockResolvedValue([
      makeLinkIgnore({ targetId: "e2" }),
      makeLinkIgnore({ targetId: "e3" }),
    ]);
    entityFindMany.mockResolvedValue([
      makeEntity({ id: "e2", name: "Robert" }),
      makeEntity({ id: "e3", name: "Aeliana" }),
    ]);

    const result = await listIgnoredTargets(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([
      { id: "e3", name: "Aeliana" },
      { id: "e2", name: "Robert" },
    ]);
  });

  it("omet silencieusement une cible introuvable (supprimee entre les deux requetes)", async () => {
    linkIgnoreFindMany.mockResolvedValue([makeLinkIgnore({ targetId: "e2" })]);
    entityFindMany.mockResolvedValue([]);

    const result = await listIgnoredTargets(OWNER_ID, WORLD_ID, ENTITY_ID);

    expect(result).toEqual([]);
  });
});

describe("ignoreLink", () => {
  const TARGET_ID = "e2";

  beforeEach(() => {
    vi.clearAllMocks();
    worldFindFirst.mockResolvedValue(makeWorld());
    entityFindFirst.mockResolvedValue(makeEntity({ id: ENTITY_ID }));
    transaction.mockResolvedValue([]);
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(ignoreLink(OWNER_ID, WORLD_ID, ENTITY_ID, TARGET_ID)).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("leve EntityNotFoundError si l'entite source n'appartient pas a ce monde", async () => {
    entityFindFirst.mockResolvedValue(null);

    await expect(ignoreLink(OWNER_ID, WORLD_ID, ENTITY_ID, TARGET_ID)).rejects.toThrow(
      EntityNotFoundError,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("ignore silencieusement un targetId qui n'appartient pas a ce monde (jamais de confiance dans l'input client)", async () => {
    // entityFindFirst est appelee deux fois : une pour getEntity (verifie
    // ENTITY_ID), une pour la revalidation de TARGET_ID - la seconde renvoie
    // null ici pour simuler une cible d'un autre monde.
    entityFindFirst
      .mockResolvedValueOnce(makeEntity({ id: ENTITY_ID }))
      .mockResolvedValueOnce(null);

    await ignoreLink(OWNER_ID, WORLD_ID, ENTITY_ID, TARGET_ID);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("cree le LinkIgnore et supprime la Relation AUTO existante en une transaction", async () => {
    entityFindFirst
      .mockResolvedValueOnce(makeEntity({ id: ENTITY_ID }))
      .mockResolvedValueOnce(makeEntity({ id: TARGET_ID }));

    await ignoreLink(OWNER_ID, WORLD_ID, ENTITY_ID, TARGET_ID);

    expect(linkIgnoreUpsert).toHaveBeenCalledWith({
      where: { entityId_targetId: { entityId: ENTITY_ID, targetId: TARGET_ID } },
      create: { worldId: WORLD_ID, entityId: ENTITY_ID, targetId: TARGET_ID },
      update: {},
    });
    expect(relationDeleteMany).toHaveBeenCalledWith({
      where: { sourceId: ENTITY_ID, targetId: TARGET_ID, origin: RelationOrigin.AUTO },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

describe("unignoreLink", () => {
  const TARGET_ID = "e2";

  beforeEach(() => {
    vi.clearAllMocks();
    worldFindFirst.mockResolvedValue(makeWorld());
    entityFindFirst.mockResolvedValue(makeEntity({ id: ENTITY_ID }));
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(unignoreLink(OWNER_ID, WORLD_ID, ENTITY_ID, TARGET_ID)).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(linkIgnoreDeleteMany).not.toHaveBeenCalled();
  });

  it("leve EntityNotFoundError si l'entite n'appartient pas a ce monde", async () => {
    entityFindFirst.mockResolvedValue(null);

    await expect(unignoreLink(OWNER_ID, WORLD_ID, ENTITY_ID, TARGET_ID)).rejects.toThrow(
      EntityNotFoundError,
    );
    expect(linkIgnoreDeleteMany).not.toHaveBeenCalled();
  });

  it("supprime le LinkIgnore correspondant", async () => {
    await unignoreLink(OWNER_ID, WORLD_ID, ENTITY_ID, TARGET_ID);

    expect(linkIgnoreDeleteMany).toHaveBeenCalledWith({
      where: { entityId: ENTITY_ID, targetId: TARGET_ID },
    });
  });
});
