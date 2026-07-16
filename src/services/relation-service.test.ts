import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { LinkIgnore, World } from "@/generated/prisma/client";
import { WorldNotFoundError } from "./world-service";
import { getIgnoredTargetIds } from "./relation-service";

// Meme regle que entity-service.test.ts : Prisma mocke, getWorld() n'est pas
// mocke - on verifie la vraie cascade d'autorisation monde -> LinkIgnore en
// laissant le mock Prisma piloter les deux.
vi.mock("@/db/client", () => ({
  prisma: {
    world: {
      findFirst: vi.fn(),
    },
    linkIgnore: {
      findMany: vi.fn(),
    },
  },
}));

const worldFindFirst = vi.mocked(prisma.world.findFirst);
const linkIgnoreFindMany = vi.mocked(prisma.linkIgnore.findMany);

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
