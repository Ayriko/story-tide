import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { Entity } from "@/generated/prisma/client";
import { RelationOrigin, UserPlan, WorldOrigin } from "@/generated/prisma/client";
import { makeUser } from "@/test-utils/make-user";
import {
  getAccountsNearLimit,
  getActivitySeries,
  getContentStats,
  getUserStats,
} from "./admin-stats-service";

// Meme regle que world-service.test.ts : Prisma mocke, aucune connexion reelle.
vi.mock("@/db/client", () => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn() },
    world: { count: vi.fn() },
    entity: { count: vi.fn(), findMany: vi.fn() },
    relation: { count: vi.fn() },
    linkIgnore: { count: vi.fn() },
    image: { count: vi.fn(), aggregate: vi.fn() },
  },
}));

const userCount = vi.mocked(prisma.user.count);
const userFindMany = vi.mocked(prisma.user.findMany);
const worldCount = vi.mocked(prisma.world.count);
const entityCount = vi.mocked(prisma.entity.count);
const entityFindMany = vi.mocked(prisma.entity.findMany);
const relationCount = vi.mocked(prisma.relation.count);
const linkIgnoreCount = vi.mocked(prisma.linkIgnore.count);
const imageCount = vi.mocked(prisma.image.count);
const imageAggregate = vi.mocked(prisma.image.aggregate);

const NOW = new Date("2026-10-13T10:00:00.000Z");
const THIRTY_DAYS_AGO = new Date("2026-09-13T10:00:00.000Z");
const SEVEN_DAYS_AGO = new Date("2026-10-06T10:00:00.000Z");

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "e1",
    worldId: "w1",
    name: "Aeliana",
    type: "character",
    content: {},
    plainText: "",
    seedRef: null,
    folderId: null,
    contentVersion: 0,
    scannedVersion: 0,
    createdAt: new Date("2026-10-10T09:00:00.000Z"),
    updatedAt: new Date("2026-10-10T09:00:00.000Z"),
    ...overrides,
  };
}

// Resultat complet de image.aggregate : le mock reste type sur l'agregat
// entier, quel que soit le _sum reellement demande (meme piege que les
// select restreints, skill prisma-mock-partial-select).
function makeImageAggregate(size: number | null) {
  return { _count: {}, _avg: {}, _sum: { size }, _min: {}, _max: {} };
}

// Compte FREE avec ses mondes USER, tels que les remonte la requete de
// getAccountsNearLimit (un compteur d'entrees par monde).
function makeAccount(id: string, entitiesPerWorld: number[]) {
  return {
    ...makeUser({ id, email: `${id}@story-tide.test` }),
    worlds: entitiesPerWorld.map((entities) => ({ _count: { entities } })),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getUserStats", () => {
  it("compte les actifs 30 j sur les entrees modifiees des mondes USER uniquement", async () => {
    userCount
      .mockResolvedValueOnce(12) // total
      .mockResolvedValueOnce(2) // 7 j
      .mockResolvedValueOnce(5) // 30 j
      .mockResolvedValueOnce(4); // actifs
    userFindMany.mockResolvedValueOnce([makeUser()]);

    const stats = await getUserStats(NOW);

    expect(userCount).toHaveBeenNthCalledWith(4, {
      where: {
        worlds: {
          some: {
            origin: WorldOrigin.USER,
            entities: { some: { updatedAt: { gte: THIRTY_DAYS_AGO } } },
          },
        },
      },
    });
    expect(stats).toMatchObject({
      total: 12,
      signedUpLast7Days: 2,
      signedUpLast30Days: 5,
      activeLast30Days: 4,
    });
  });

  it("borne les inscrits a 7 et 30 jours glissants et remonte les 5 derniers inscrits", async () => {
    userCount.mockResolvedValue(0);
    userFindMany.mockResolvedValueOnce([]);

    await getUserStats(NOW);

    expect(userCount).toHaveBeenNthCalledWith(2, { where: { createdAt: { gte: SEVEN_DAYS_AGO } } });
    expect(userCount).toHaveBeenNthCalledWith(3, {
      where: { createdAt: { gte: THIRTY_DAYS_AGO } },
    });
    expect(userFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, email: true, name: true, createdAt: true },
    });
  });
});

describe("getContentStats", () => {
  it("separe mondes USER et total, relations AUTO et MANUAL, et somme la taille des images", async () => {
    worldCount.mockResolvedValueOnce(9).mockResolvedValueOnce(6);
    entityCount.mockResolvedValueOnce(140);
    relationCount.mockResolvedValueOnce(80).mockResolvedValueOnce(15);
    linkIgnoreCount.mockResolvedValueOnce(3);
    imageCount.mockResolvedValueOnce(7);
    imageAggregate.mockResolvedValueOnce(makeImageAggregate(3_145_728));

    const stats = await getContentStats();

    expect(worldCount).toHaveBeenNthCalledWith(2, { where: { origin: WorldOrigin.USER } });
    expect(relationCount).toHaveBeenNthCalledWith(1, { where: { origin: RelationOrigin.AUTO } });
    expect(relationCount).toHaveBeenNthCalledWith(2, { where: { origin: RelationOrigin.MANUAL } });
    expect(stats).toEqual({
      worldsTotal: 9,
      worldsUser: 6,
      entities: 140,
      relationsAuto: 80,
      relationsManual: 15,
      linksIgnored: 3,
      images: 7,
      imagesBytes: 3_145_728,
    });
  });

  it("rend 0 octet quand aucune image n'existe (somme nulle)", async () => {
    worldCount.mockResolvedValue(0);
    entityCount.mockResolvedValue(0);
    relationCount.mockResolvedValue(0);
    linkIgnoreCount.mockResolvedValue(0);
    imageCount.mockResolvedValue(0);
    imageAggregate.mockResolvedValueOnce(makeImageAggregate(null));

    await expect(getContentStats()).resolves.toMatchObject({ imagesBytes: 0 });
  });
});

describe("getActivitySeries", () => {
  it("ne lit que deux horodatages, sur les mondes USER, et decoupe par jour", async () => {
    entityFindMany.mockResolvedValueOnce([makeEntity()]);

    const series = await getActivitySeries(NOW);

    expect(entityFindMany).toHaveBeenCalledWith({
      where: { world: { origin: WorldOrigin.USER }, updatedAt: { gte: THIRTY_DAYS_AGO } },
      select: { createdAt: true, updatedAt: true },
    });
    expect(series).toHaveLength(30);
    expect(series.find((day) => day.date === "2026-10-10")).toEqual({
      date: "2026-10-10",
      created: 1,
      modified: 1,
    });
  });
});

describe("getAccountsNearLimit", () => {
  it("ne regarde que les comptes FREE et leurs mondes USER", async () => {
    userFindMany.mockResolvedValueOnce([]);

    await getAccountsNearLimit();

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { plan: UserPlan.FREE, worlds: { some: { origin: WorldOrigin.USER } } },
        select: expect.objectContaining({
          worlds: {
            where: { origin: WorldOrigin.USER },
            select: { _count: { select: { entities: true } } },
          },
        }),
      }),
    );
  });

  it("retient un compte a 3 mondes, ou avec un monde a 40 entrees, et pas les autres", async () => {
    userFindMany.mockResolvedValueOnce([
      makeAccount("trois-mondes", [1, 2, 0]),
      makeAccount("monde-plein", [40]),
      makeAccount("juste-dessous", [39, 39]),
      makeAccount("au-plafond", [50, 3]),
    ]);

    const accounts = await getAccountsNearLimit();

    expect(accounts.map((account) => account.id)).toEqual([
      "trois-mondes",
      "monde-plein",
      "au-plafond",
    ]);
    expect(accounts[1]).toMatchObject({
      worlds: 1,
      fullestWorldEntities: 40,
      worldLimit: 3,
      entityLimit: 50,
    });
  });
});
