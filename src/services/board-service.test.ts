import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { World } from "@/generated/prisma/client";
import { Prisma, WorldOrigin } from "@/generated/prisma/client";
import { EntityNotFoundError } from "./entity-service";
import { WorldNotFoundError } from "./world-service";
import {
  getDefaultBoardLayout,
  replaceLayout,
  saveNodePositions,
  saveViewport,
} from "./board-service";

// Prisma mocke ; getWorld (world.findFirst) est reel - l'appartenance du
// monde puis des entrees est exercee.
vi.mock("@/db/client", () => ({
  prisma: {
    world: { findFirst: vi.fn() },
    entity: { count: vi.fn() },
    board: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    boardNode: { upsert: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const worldFindFirst = vi.mocked(prisma.world.findFirst);
const entityCount = vi.mocked(prisma.entity.count);
const boardFindFirst = vi.mocked(prisma.board.findFirst);
const boardCreate = vi.mocked(prisma.board.create);
const boardUpdate = vi.mocked(prisma.board.update);
const nodeUpsert = vi.mocked(prisma.boardNode.upsert);
const nodeDeleteMany = vi.mocked(prisma.boardNode.deleteMany);
const nodeCreateMany = vi.mocked(prisma.boardNode.createMany);
const transaction = vi.mocked(prisma.$transaction);

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";
const DATE = new Date("2026-10-24T00:00:00.000Z");

function makeWorld(): World {
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
  };
}

// Ligne Board au format du select restreint du service.
function makeBoard(
  overrides: Partial<{
    zoom: number | null;
    panX: number | null;
    panY: number | null;
    nodes: { entityId: string; x: number; y: number }[];
  }> = {},
) {
  return { id: "b1", zoom: null, panX: null, panY: null, nodes: [], ...overrides } as never;
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("violation", { code, clientVersion: "test" });
}

// mockReset : aucune file ...Once heritee d'un test en echec
// (skill vitest-clearallmocks-once-queue). Transaction interactive : le
// callback recoit le MEME client mocke.
beforeEach(() => {
  vi.resetAllMocks();
  transaction.mockImplementation(async (run) => run(prisma));
});

describe("getDefaultBoardLayout", () => {
  it("monde d'un autre proprietaire : « introuvable », aucun tableau lu ni cree", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(getDefaultBoardLayout("intrus", WORLD_ID)).rejects.toBeInstanceOf(
      WorldNotFoundError,
    );
    expect(worldFindFirst).toHaveBeenCalledWith({ where: { id: WORLD_ID, ownerId: "intrus" } });
    expect(boardFindFirst).not.toHaveBeenCalled();
    expect(boardCreate).not.toHaveBeenCalled();
  });

  it("tableau existant : positions et cadrage restitues", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    boardFindFirst.mockResolvedValue(
      makeBoard({ zoom: 1.5, panX: 10, panY: -4, nodes: [{ entityId: "e1", x: 3, y: 7 }] }),
    );

    const layout = await getDefaultBoardLayout(OWNER_ID, WORLD_ID);

    expect(boardFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { worldId: WORLD_ID, isDefault: true } }),
    );
    expect(layout.boardId).toBe("b1");
    expect(layout.viewport).toEqual({ zoom: 1.5, panX: 10, panY: -4 });
    expect(layout.positions.get("e1")).toEqual({ x: 3, y: 7 });
    expect(boardCreate).not.toHaveBeenCalled();
  });

  it("premier passage : tableau par defaut cree a la demande, jamais cadre", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    boardFindFirst.mockResolvedValue(null);
    boardCreate.mockResolvedValue(makeBoard());

    const layout = await getDefaultBoardLayout(OWNER_ID, WORLD_ID);

    expect(boardCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { worldId: WORLD_ID, name: "Constellation", isDefault: true },
      }),
    );
    expect(layout.viewport).toBeNull();
    expect(layout.positions.size).toBe(0);
  });

  it("course entre deux premieres visites (P2002) : le tableau du gagnant est relu", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    boardFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeBoard({ nodes: [{ entityId: "e1", x: 1, y: 2 }] }));
    boardCreate.mockRejectedValue(prismaError("P2002"));

    const layout = await getDefaultBoardLayout(OWNER_ID, WORLD_ID);

    expect(boardFindFirst).toHaveBeenCalledTimes(2);
    expect(layout.positions.get("e1")).toEqual({ x: 1, y: 2 });
  });

  it("P2002 sans tableau relisible : l'erreur d'origine remonte", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    boardFindFirst.mockResolvedValue(null);
    const violation = prismaError("P2002");
    boardCreate.mockRejectedValue(violation);

    await expect(getDefaultBoardLayout(OWNER_ID, WORLD_ID)).rejects.toBe(violation);
  });

  it("autre erreur de creation : remonte telle quelle, pas de relecture", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    boardFindFirst.mockResolvedValue(null);
    const failure = new Error("connexion perdue");
    boardCreate.mockRejectedValue(failure);

    await expect(getDefaultBoardLayout(OWNER_ID, WORLD_ID)).rejects.toBe(failure);
    expect(boardFindFirst).toHaveBeenCalledTimes(1);
  });
});

describe("saveNodePositions", () => {
  it("monde d'un autre proprietaire : « introuvable », rien n'est ecrit", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(
      saveNodePositions("intrus", WORLD_ID, [{ entityId: "e1", x: 0, y: 0 }]),
    ).rejects.toBeInstanceOf(WorldNotFoundError);
    expect(nodeUpsert).not.toHaveBeenCalled();
  });

  it("entree d'un autre monde : « introuvable » (patron A01), rien n'est ecrit", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    entityCount.mockResolvedValue(1);

    await expect(
      saveNodePositions(OWNER_ID, WORLD_ID, [
        { entityId: "e1", x: 0, y: 0 },
        { entityId: "e-ailleurs", x: 5, y: 5 },
      ]),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
    expect(entityCount).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID, id: { in: ["e1", "e-ailleurs"] } },
    });
    expect(boardFindFirst).not.toHaveBeenCalled();
    expect(nodeUpsert).not.toHaveBeenCalled();
  });

  it("upsert de chaque position en transaction, doublon d'id dedoublonne (derniere gagne)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    entityCount.mockResolvedValue(2);
    boardFindFirst.mockResolvedValue(makeBoard());

    await saveNodePositions(OWNER_ID, WORLD_ID, [
      { entityId: "e1", x: 0, y: 0 },
      { entityId: "e2", x: 4, y: 4 },
      { entityId: "e1", x: 9, y: 9 },
    ]);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(nodeUpsert).toHaveBeenCalledTimes(2);
    expect(nodeUpsert).toHaveBeenCalledWith({
      where: { boardId_entityId: { boardId: "b1", entityId: "e1" } },
      create: { boardId: "b1", entityId: "e1", x: 9, y: 9 },
      update: { x: 9, y: 9 },
    });
  });

  it("lot vide : aucune verification d'entree, transaction vide", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    boardFindFirst.mockResolvedValue(makeBoard());

    await saveNodePositions(OWNER_ID, WORLD_ID, []);

    expect(entityCount).not.toHaveBeenCalled();
    expect(nodeUpsert).not.toHaveBeenCalled();
  });
});

describe("saveViewport", () => {
  it("monde d'un autre proprietaire : « introuvable »", async () => {
    worldFindFirst.mockResolvedValue(null);

    await expect(
      saveViewport("intrus", WORLD_ID, { zoom: 1, panX: 0, panY: 0 }),
    ).rejects.toBeInstanceOf(WorldNotFoundError);
    expect(boardUpdate).not.toHaveBeenCalled();
  });

  it("met a jour le cadrage du tableau par defaut", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    boardFindFirst.mockResolvedValue(makeBoard());

    await saveViewport(OWNER_ID, WORLD_ID, { zoom: 2, panX: 12, panY: -3 });

    expect(boardUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { zoom: 2, panX: 12, panY: -3 },
    });
  });
});

describe("replaceLayout", () => {
  it("remplace toute la disposition en transaction (suppression puis creation)", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    entityCount.mockResolvedValue(2);
    boardFindFirst.mockResolvedValue(
      makeBoard({ nodes: [{ entityId: "e-ancienne", x: 0, y: 0 }] }),
    );

    await replaceLayout(OWNER_ID, WORLD_ID, [
      { entityId: "e1", x: 1, y: 1 },
      { entityId: "e2", x: 2, y: 2 },
    ]);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(nodeDeleteMany).toHaveBeenCalledWith({ where: { boardId: "b1" } });
    expect(nodeCreateMany).toHaveBeenCalledWith({
      data: [
        { boardId: "b1", entityId: "e1", x: 1, y: 1 },
        { boardId: "b1", entityId: "e2", x: 2, y: 2 },
      ],
    });
    expect(nodeDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      nodeCreateMany.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("entree d'un autre monde : « introuvable », la disposition existante reste intacte", async () => {
    worldFindFirst.mockResolvedValue(makeWorld());
    entityCount.mockResolvedValue(0);

    await expect(
      replaceLayout(OWNER_ID, WORLD_ID, [{ entityId: "e-ailleurs", x: 1, y: 1 }]),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
    expect(nodeDeleteMany).not.toHaveBeenCalled();
    expect(nodeCreateMany).not.toHaveBeenCalled();
  });
});
