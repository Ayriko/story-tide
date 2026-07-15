import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { Entity } from "@/generated/prisma/client";
import { EMPTY_CONTENT } from "@/lib/tiptap-content";
import { buildDictionary } from "./linker-service";

// Meme regle que world-service.test.ts / entity-service.test.ts : Prisma
// mocke, aucune connexion reelle.
vi.mock("@/db/client", () => ({
  prisma: {
    entity: {
      findMany: vi.fn(),
    },
  },
}));

const entityFindMany = vi.mocked(prisma.entity.findMany);

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
