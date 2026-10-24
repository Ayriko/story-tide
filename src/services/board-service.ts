import { cache } from "react";
import { prisma } from "@/db/client";
import { Prisma } from "@/generated/prisma/client";
import type { BoardPosition, BoardViewport } from "@/lib/board-schemas";
import { EntityNotFoundError } from "./entity-service";
import { getWorld } from "./world-service";

// Disposition de la Constellation (KAN-87, ADR-0032) : place des etoiles,
// zoom et cadrage, partages au niveau du MONDE (un tableau par defaut, cree a
// la demande - pas de backfill). Chaque fonction exportee : ownerId en
// premier, appartenance verifiee (OWASP A01). Une entree et son tableau
// appartiennent au meme monde : verifie ici (pas de FK composite en base).

const DEFAULT_BOARD_NAME = "Constellation";

export type BoardLayout = {
  boardId: string;
  // null : jamais cadre, le graphe s'ajuste a l'ecran.
  viewport: BoardViewport | null;
  positions: Map<string, { x: number; y: number }>;
};

const BOARD_SELECT = {
  id: true,
  zoom: true,
  panX: true,
  panY: true,
  nodes: { select: { entityId: true, x: true, y: true } },
} satisfies Prisma.BoardSelect;

type BoardRow = Prisma.BoardGetPayload<{ select: typeof BOARD_SELECT }>;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function findDefaultBoard(worldId: string): Promise<BoardRow | null> {
  return prisma.board.findFirst({ where: { worldId, isDefault: true }, select: BOARD_SELECT });
}

// Course entre deux premieres visites simultanees : l'index unique partiel
// (un seul tableau par defaut par monde) tranche, le perdant relit le
// tableau du gagnant. Monde deja verifie par l'appelant.
async function getOrCreateDefaultBoard(worldId: string): Promise<BoardRow> {
  const existing = await findDefaultBoard(worldId);
  if (existing) {
    return existing;
  }
  try {
    return await prisma.board.create({
      data: { worldId, name: DEFAULT_BOARD_NAME, isDefault: true },
      select: BOARD_SELECT,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const winner = await findDefaultBoard(worldId);
    if (!winner) {
      throw error;
    }
    return winner;
  }
}

// Une seule entree par id (la derniere position gagne) : un lot regroupe
// cote client peut porter deux fois la meme etoile.
function dedupePositions(positions: BoardPosition[]): BoardPosition[] {
  return [...new Map(positions.map((position) => [position.entityId, position])).values()];
}

// Toute position doit viser une entree du monde : sinon « introuvable »,
// meme reponse qu'une entree inexistante (patron A01).
async function assertEntitiesInWorld(worldId: string, entityIds: string[]): Promise<void> {
  if (entityIds.length === 0) {
    return;
  }
  const found = await prisma.entity.count({ where: { worldId, id: { in: entityIds } } });
  if (found !== entityIds.length) {
    throw new EntityNotFoundError();
  }
}

// cache() de React : une seule lecture par rendu serveur.
export const getDefaultBoardLayout = cache(
  async (ownerId: string, worldId: string): Promise<BoardLayout> => {
    await getWorld(ownerId, worldId);
    const board = await getOrCreateDefaultBoard(worldId);
    const viewport =
      board.zoom !== null && board.panX !== null && board.panY !== null
        ? { zoom: board.zoom, panX: board.panX, panY: board.panY }
        : null;
    return {
      boardId: board.id,
      viewport,
      positions: new Map(board.nodes.map(({ entityId, x, y }) => [entityId, { x, y }])),
    };
  },
);

export async function saveNodePositions(
  ownerId: string,
  worldId: string,
  positions: BoardPosition[],
): Promise<void> {
  await getWorld(ownerId, worldId);
  const unique = dedupePositions(positions);
  await assertEntitiesInWorld(
    worldId,
    unique.map(({ entityId }) => entityId),
  );
  const board = await getOrCreateDefaultBoard(worldId);
  await prisma.$transaction(async (tx) => {
    for (const { entityId, x, y } of unique) {
      await tx.boardNode.upsert({
        where: { boardId_entityId: { boardId: board.id, entityId } },
        create: { boardId: board.id, entityId, x, y },
        update: { x, y },
      });
    }
  });
}

export async function saveViewport(
  ownerId: string,
  worldId: string,
  viewport: BoardViewport,
): Promise<void> {
  await getWorld(ownerId, worldId);
  const board = await getOrCreateDefaultBoard(worldId);
  await prisma.board.update({ where: { id: board.id }, data: viewport });
}

// Remplace TOUTE la disposition (Reorganiser, et Annuler qui renvoie
// l'instantane precedent) : une etoile absente du lot perd sa position.
export async function replaceLayout(
  ownerId: string,
  worldId: string,
  positions: BoardPosition[],
): Promise<void> {
  await getWorld(ownerId, worldId);
  const unique = dedupePositions(positions);
  await assertEntitiesInWorld(
    worldId,
    unique.map(({ entityId }) => entityId),
  );
  const board = await getOrCreateDefaultBoard(worldId);
  await prisma.$transaction(async (tx) => {
    await tx.boardNode.deleteMany({ where: { boardId: board.id } });
    await tx.boardNode.createMany({
      data: unique.map(({ entityId, x, y }) => ({ boardId: board.id, entityId, x, y })),
    });
  });
}
