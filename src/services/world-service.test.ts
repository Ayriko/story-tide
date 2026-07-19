import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { World } from "@/generated/prisma/client";
import { WorldOrigin } from "@/generated/prisma/client";
import {
  WorldNotFoundError,
  WorldQuotaExceededError,
  createWorld,
  deleteWorld,
  getWorld,
  getWorldBySlug,
  listWorlds,
  updateWorld,
} from "./world-service";

// Port Prisma mocke - aucun test de ce fichier ne touche une vraie base (regle
// du projet : les tests unitaires n'ouvrent jamais de connexion reelle, cf.
// commentaire du job CI). Seule la logique du service (authz, derivation de
// slug) est verifiee ici.
vi.mock("@/db/client", () => ({
  prisma: {
    world: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const worldFindUnique = vi.mocked(prisma.world.findUnique);
const worldFindMany = vi.mocked(prisma.world.findMany);
const worldFindFirst = vi.mocked(prisma.world.findFirst);
const worldCount = vi.mocked(prisma.world.count);
const worldCreate = vi.mocked(prisma.world.create);
const worldUpdate = vi.mocked(prisma.world.update);
const worldDelete = vi.mocked(prisma.world.delete);

const OWNER_ID = "owner-1";

function makeWorld(overrides: Partial<World> = {}): World {
  return {
    id: "w1",
    ownerId: OWNER_ID,
    name: "Eldoria",
    slug: "eldoria",
    origin: WorldOrigin.USER,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createWorld", () => {
  it("derive le slug du nom et cree le monde quand le slug est libre", async () => {
    worldCount.mockResolvedValueOnce(0);
    worldFindUnique.mockResolvedValueOnce(null);
    worldCreate.mockResolvedValueOnce(makeWorld({ id: "w1", slug: "eldoria" }));

    const world = await createWorld(OWNER_ID, { name: "Eldoria" });

    expect(worldCount).toHaveBeenCalledWith({
      where: { ownerId: OWNER_ID, origin: WorldOrigin.USER },
    });
    expect(worldCreate).toHaveBeenCalledWith({
      data: { ownerId: OWNER_ID, name: "Eldoria", slug: "eldoria" },
    });
    expect(world.slug).toBe("eldoria");
  });

  it("suffixe le slug en cas de collision pour ce proprietaire", async () => {
    worldCount.mockResolvedValueOnce(0);
    worldFindUnique
      .mockResolvedValueOnce(makeWorld({ id: "existing" })) // "eldoria" deja pris
      .mockResolvedValueOnce(null); // "eldoria-2" libre
    worldCreate.mockResolvedValueOnce(makeWorld({ id: "w2", slug: "eldoria-2" }));

    const world = await createWorld(OWNER_ID, { name: "Eldoria" });

    expect(world.slug).toBe("eldoria-2");
    expect(worldCreate).toHaveBeenCalledWith({
      data: { ownerId: OWNER_ID, name: "Eldoria", slug: "eldoria-2" },
    });
  });

  it("autorise la creation juste sous la limite (2 mondes existants)", async () => {
    worldCount.mockResolvedValueOnce(2);
    worldFindUnique.mockResolvedValueOnce(null);
    worldCreate.mockResolvedValueOnce(makeWorld({ id: "w3" }));

    await createWorld(OWNER_ID, { name: "Eldoria" });

    expect(worldCreate).toHaveBeenCalled();
  });

  it("leve WorldQuotaExceededError a la limite (3 mondes existants), sans creer", async () => {
    worldCount.mockResolvedValueOnce(3);

    await expect(createWorld(OWNER_ID, { name: "Eldoria" })).rejects.toThrow(
      WorldQuotaExceededError,
    );
    expect(worldFindUnique).not.toHaveBeenCalled();
    expect(worldCreate).not.toHaveBeenCalled();
  });
});

describe("listWorlds", () => {
  it("liste les mondes du proprietaire tries par date de creation decroissante", async () => {
    worldFindMany.mockResolvedValueOnce([]);

    await listWorlds(OWNER_ID);

    expect(worldFindMany).toHaveBeenCalledWith({
      where: { ownerId: OWNER_ID },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("getWorld", () => {
  it("retourne le monde s'il appartient au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ id: "w1" }));

    const world = await getWorld(OWNER_ID, "w1");

    expect(world.id).toBe("w1");
    expect(worldFindFirst).toHaveBeenCalledWith({ where: { id: "w1", ownerId: OWNER_ID } });
  });

  it("leve WorldNotFoundError si le monde n'existe pas", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(getWorld(OWNER_ID, "unknown")).rejects.toThrow(WorldNotFoundError);
  });

  it("leve WorldNotFoundError si le monde appartient a un autre utilisateur (pas de fuite d'existence)", async () => {
    // Le mock simule le filtrage reel: findFirst({id, ownerId}) sur un monde
    // d'autrui ne renvoie rien, comme le ferait vraiment Prisma.
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(getWorld(OWNER_ID, "world-of-someone-else")).rejects.toThrow(WorldNotFoundError);
    expect(worldFindFirst).toHaveBeenCalledWith({
      where: { id: "world-of-someone-else", ownerId: OWNER_ID },
    });
  });
});

describe("getWorldBySlug", () => {
  it("retourne le monde s'il existe pour ce proprietaire", async () => {
    worldFindUnique.mockResolvedValueOnce(makeWorld({ id: "w1", slug: "eldoria" }));

    const world = await getWorldBySlug(OWNER_ID, "eldoria");

    expect(world.slug).toBe("eldoria");
  });

  it("leve WorldNotFoundError si le slug n'existe pas pour ce proprietaire", async () => {
    worldFindUnique.mockResolvedValueOnce(null);

    await expect(getWorldBySlug(OWNER_ID, "inconnu")).rejects.toThrow(WorldNotFoundError);
  });
});

describe("updateWorld", () => {
  it("renomme et recalcule le slug", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ id: "w1", slug: "eldoria" }));
    worldFindUnique.mockResolvedValueOnce(null); // "nouveau-nom" libre
    worldUpdate.mockResolvedValueOnce(
      makeWorld({ id: "w1", name: "Nouveau Nom", slug: "nouveau-nom" }),
    );

    const world = await updateWorld(OWNER_ID, "w1", { name: "Nouveau Nom" });

    expect(world.slug).toBe("nouveau-nom");
    expect(worldUpdate).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { name: "Nouveau Nom", slug: "nouveau-nom" },
    });
  });

  it("ne se bloque pas sur son propre slug actuel en cas de renommage neutre", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ id: "w1", slug: "eldoria" }));
    // Le slug candidat "eldoria" existe deja... et c'est le monde lui-meme (id "w1").
    worldFindUnique.mockResolvedValueOnce(makeWorld({ id: "w1", slug: "eldoria" }));
    worldUpdate.mockResolvedValueOnce(makeWorld({ id: "w1", slug: "eldoria" }));

    const world = await updateWorld(OWNER_ID, "w1", { name: "Eldoria" });

    expect(world.slug).toBe("eldoria");
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(updateWorld(OWNER_ID, "w1", { name: "X" })).rejects.toThrow(WorldNotFoundError);
    expect(worldUpdate).not.toHaveBeenCalled();
  });
});

describe("deleteWorld", () => {
  it("supprime le monde s'il appartient au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld({ id: "w1" }));

    await deleteWorld(OWNER_ID, "w1");

    expect(worldDelete).toHaveBeenCalledWith({ where: { id: "w1" } });
  });

  it("leve WorldNotFoundError et ne supprime rien si le monde n'appartient pas au proprietaire", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(deleteWorld(OWNER_ID, "w1")).rejects.toThrow(WorldNotFoundError);
    expect(worldDelete).not.toHaveBeenCalled();
  });
});
