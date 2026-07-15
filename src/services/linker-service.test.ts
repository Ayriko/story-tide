import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { Entity, LinkIgnore, Relation } from "@/generated/prisma/client";
import { RelationOrigin } from "@/generated/prisma/client";
import { EMPTY_CONTENT } from "@/lib/tiptap-content";
import { buildDictionary, scanAndLinkEntity } from "./linker-service";

// Meme regle que world-service.test.ts / entity-service.test.ts : Prisma
// mocke, aucune connexion reelle.
vi.mock("@/db/client", () => ({
  prisma: {
    entity: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    linkIgnore: {
      findMany: vi.fn(),
    },
    relation: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const entityFindFirst = vi.mocked(prisma.entity.findFirst);
const entityFindMany = vi.mocked(prisma.entity.findMany);
const linkIgnoreFindMany = vi.mocked(prisma.linkIgnore.findMany);
const relationFindMany = vi.mocked(prisma.relation.findMany);
const relationCreateMany = vi.mocked(prisma.relation.createMany);
const relationDeleteMany = vi.mocked(prisma.relation.deleteMany);
const transaction = vi.mocked(prisma.$transaction);

const WORLD_ID = "w1";

// Objet complet (pas un litteral partiel) malgre le `select` reel de
// buildDictionary : meme convention que world-service.test.ts/
// entity-service.test.ts (le mock Prisma reste type sur le modele complet).
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

// Meme convention que makeEntity : objets complets malgre les `select`
// reels de scanAndLinkEntity (targetId seul).
function makeRelation(overrides: Partial<Relation> = {}): Relation {
  return {
    id: "r1",
    worldId: WORLD_ID,
    sourceId: "src1",
    targetId: "e1",
    origin: RelationOrigin.AUTO,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeLinkIgnore(overrides: Partial<LinkIgnore> = {}): LinkIgnore {
  return {
    id: "li1",
    worldId: WORLD_ID,
    entityId: "src1",
    targetId: "e1",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildDictionary", () => {
  it("retourne un dictionnaire vide pour un monde sans entite", async () => {
    entityFindMany.mockResolvedValue([]);

    const patterns = await buildDictionary(WORLD_ID);

    expect(patterns).toEqual([]);
    expect(entityFindMany).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID },
      select: { id: true, name: true, aliases: true },
    });
  });

  it("produit un seul motif (le nom) pour une entite sans alias", async () => {
    entityFindMany.mockResolvedValue([makeEntity({ id: "e1", name: "Aeliana", aliases: [] })]);

    const patterns = await buildDictionary(WORLD_ID);

    expect(patterns).toEqual([{ entityId: "e1", term: "Aeliana" }]);
  });

  it("produit un motif par alias en plus du motif du nom", async () => {
    entityFindMany.mockResolvedValue([
      makeEntity({ id: "e1", name: "Jon Neige", aliases: ["Roi du Nord", "Le Batard"] }),
    ]);

    const patterns = await buildDictionary(WORLD_ID);

    expect(patterns).toEqual([
      { entityId: "e1", term: "Jon Neige" },
      { entityId: "e1", term: "Roi du Nord" },
      { entityId: "e1", term: "Le Batard" },
    ]);
  });

  it("aplati les motifs de plusieurs entites dans l'ordre de la requete", async () => {
    entityFindMany.mockResolvedValue([
      makeEntity({ id: "e1", name: "Aeliana", aliases: ["Reine du Nord"] }),
      makeEntity({ id: "e2", name: "Robert", aliases: [] }),
    ]);

    const patterns = await buildDictionary(WORLD_ID);

    expect(patterns).toEqual([
      { entityId: "e1", term: "Aeliana" },
      { entityId: "e1", term: "Reine du Nord" },
      { entityId: "e2", term: "Robert" },
    ]);
  });
});

const SOURCE_ID = "src1";

describe("scanAndLinkEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkIgnoreFindMany.mockResolvedValue([]);
    relationFindMany.mockResolvedValue([]);
    transaction.mockResolvedValue([]);
  });

  it("ne fait rien si la fiche a ete supprimee avant le traitement du job", async () => {
    entityFindFirst.mockResolvedValue(null);

    await scanAndLinkEntity(WORLD_ID, SOURCE_ID);

    expect(entityFindMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("ajoute une Relation AUTO pour une nouvelle mention detectee", async () => {
    entityFindFirst.mockResolvedValue(makeEntity({ id: SOURCE_ID, plainText: "Aeliana parle." }));
    entityFindMany.mockResolvedValue([makeEntity({ id: "e1", name: "Aeliana", aliases: [] })]);

    await scanAndLinkEntity(WORLD_ID, SOURCE_ID);

    expect(relationCreateMany).toHaveBeenCalledWith({
      data: [
        { worldId: WORLD_ID, sourceId: SOURCE_ID, targetId: "e1", origin: RelationOrigin.AUTO },
      ],
      skipDuplicates: true,
    });
    expect(relationDeleteMany).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("supprime une Relation AUTO dont la mention a disparu du texte", async () => {
    entityFindFirst.mockResolvedValue(makeEntity({ id: SOURCE_ID, plainText: "Plus rien ici." }));
    entityFindMany.mockResolvedValue([makeEntity({ id: "e1", name: "Aeliana", aliases: [] })]);
    relationFindMany.mockResolvedValue([makeRelation({ sourceId: SOURCE_ID, targetId: "e1" })]);

    await scanAndLinkEntity(WORLD_ID, SOURCE_ID);

    expect(relationDeleteMany).toHaveBeenCalledWith({
      where: { sourceId: SOURCE_ID, origin: RelationOrigin.AUTO, targetId: { in: ["e1"] } },
    });
    expect(relationCreateMany).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("ne lit et n'ecrit jamais les relations MANUAL (filtre origin=AUTO explicite)", async () => {
    entityFindFirst.mockResolvedValue(makeEntity({ id: SOURCE_ID, plainText: "Rien ici." }));
    entityFindMany.mockResolvedValue([makeEntity({ id: "e1", name: "Aeliana", aliases: [] })]);
    relationFindMany.mockResolvedValue([makeRelation({ sourceId: SOURCE_ID, targetId: "e1" })]);

    await scanAndLinkEntity(WORLD_ID, SOURCE_ID);

    expect(relationFindMany).toHaveBeenCalledWith({
      where: { sourceId: SOURCE_ID, origin: RelationOrigin.AUTO },
      select: { targetId: true },
    });
    expect(relationDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ origin: RelationOrigin.AUTO }) }),
    );
  });

  it("respecte LinkIgnore : une mention presente mais ignoree ne cree pas de relation", async () => {
    entityFindFirst.mockResolvedValue(makeEntity({ id: SOURCE_ID, plainText: "Aeliana parle." }));
    entityFindMany.mockResolvedValue([makeEntity({ id: "e1", name: "Aeliana", aliases: [] })]);
    linkIgnoreFindMany.mockResolvedValue([makeLinkIgnore({ entityId: SOURCE_ID, targetId: "e1" })]);

    await scanAndLinkEntity(WORLD_ID, SOURCE_ID);

    expect(relationCreateMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("exclut l'auto-mention (une fiche qui contient son propre nom)", async () => {
    entityFindFirst.mockResolvedValue(
      makeEntity({ id: SOURCE_ID, name: "Chronique", plainText: "La Chronique se termine ici." }),
    );
    entityFindMany.mockResolvedValue([
      makeEntity({ id: SOURCE_ID, name: "Chronique", aliases: [] }),
    ]);

    await scanAndLinkEntity(WORLD_ID, SOURCE_ID);

    expect(relationCreateMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("occurrence ambigue (deux entites homonymes, memes bornes) : aucune relation creee", async () => {
    entityFindFirst.mockResolvedValue(makeEntity({ id: SOURCE_ID, plainText: "Aeliana parle." }));
    entityFindMany.mockResolvedValue([
      makeEntity({ id: "e1", name: "Aeliana", aliases: [] }),
      makeEntity({ id: "e2", name: "Aeliana", aliases: [] }),
    ]);

    await scanAndLinkEntity(WORLD_ID, SOURCE_ID);

    expect(relationCreateMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
