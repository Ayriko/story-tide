import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import { RelationOrigin } from "@/generated/prisma/client";
import { PERF_WORLD, type PerfWorldPlan } from "@/lib/perf-world-generator";
import { seedPerfWorld } from "./perf-world-service";

vi.mock("@/db/client", () => ({
  prisma: {
    world: { deleteMany: vi.fn(), create: vi.fn() },
    entity: { createMany: vi.fn() },
    relation: { createMany: vi.fn() },
    declaredRelation: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Aucun job ne doit partir : la file est mockee pour le prouver (un import
// accidentel du service vers @/lib/queue serait appele ici).
const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("@/lib/queue", () => ({ jobQueue: { enqueue } }));

const worldDeleteMany = vi.mocked(prisma.world.deleteMany);
const worldCreate = vi.mocked(prisma.world.create);
const entityCreateMany = vi.mocked(prisma.entity.createMany);
const relationCreateMany = vi.mocked(prisma.relation.createMany);
const declaredCreateMany = vi.mocked(prisma.declaredRelation.createMany);
const transaction = vi.mocked(prisma.$transaction);

const PLAN: PerfWorldPlan = {
  entities: [
    { ref: "perf-001", name: "Alber", type: "character", group: "Personnages" },
    { ref: "perf-002", name: "Corvi", type: "place", group: "Lieux" },
    { ref: "perf-003", name: "Draxa", type: "spell", group: "Magie" },
  ],
  textLinks: [
    { source: 0, target: 1, origin: "AUTO" },
    { source: 0, target: 2, origin: "MANUAL" },
  ],
  declared: [
    { source: 2, target: 1, type: "ally" },
    { source: 2, target: 0, type: "parent" },
  ],
};

function firstArg<T>(mock: { mock: { calls: T[][] } }): T {
  const arg = mock.mock.calls[0]?.[0];
  if (arg === undefined) {
    throw new Error("appel absent");
  }
  return arg;
}

// createMany accepte une ligne ou un tableau : on lit toujours un tableau.
function rows<T>(data: T | T[]): T[] {
  return Array.isArray(data) ? data : [data];
}

function entityRows() {
  return rows(firstArg(entityCreateMany)?.data ?? []);
}

beforeEach(() => {
  vi.resetAllMocks();
  transaction.mockImplementation(async (run) => run(prisma));
  worldCreate.mockResolvedValue({ id: "w-perf" } as never);
});

describe("seedPerfWorld", () => {
  it("supprime le monde de test precedent du proprietaire AVANT de le recreer", async () => {
    const summary = await seedPerfWorld("owner-1", PLAN);

    expect(worldDeleteMany).toHaveBeenCalledWith({
      where: { ownerId: "owner-1", slug: PERF_WORLD.slug },
    });
    expect(worldDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      worldCreate.mock.invocationCallOrder[0] ?? 0,
    );
    expect(worldCreate).toHaveBeenCalledWith({
      data: { ownerId: "owner-1", name: PERF_WORLD.name, slug: PERF_WORLD.slug },
      select: { id: true },
    });
    expect(summary).toEqual({ worldId: "w-perf", entities: 3, textLinks: 2, declared: 2 });
  });

  it("ecrit les entrees avec un texte qui cite les cibles (nom AUTO, mention MANUAL)", async () => {
    await seedPerfWorld("owner-1", PLAN);

    const data = entityRows();
    expect(data.map((e) => e.seedRef)).toEqual(["perf-001", "perf-002", "perf-003"]);
    expect(new Set(data.map((e) => e.id)).size).toBe(3);
    const [alber, corvi] = data;
    expect(alber?.plainText).toContain("Corvi");
    expect(JSON.stringify(alber?.content)).toContain(`"id":"${data[2]?.id}"`);
    expect(corvi?.plainText).toBe("Corvi veille seul.");
  });

  it("ecrit les liens du texte avec leur origine, sur les id generes", async () => {
    await seedPerfWorld("owner-1", PLAN);

    const ids = entityRows().map((e) => e.id);
    expect(firstArg(relationCreateMany)).toEqual({
      data: [
        { worldId: "w-perf", sourceId: ids[0], targetId: ids[1], origin: RelationOrigin.AUTO },
        { worldId: "w-perf", sourceId: ids[0], targetId: ids[2], origin: RelationOrigin.MANUAL },
      ],
    });
  });

  it("relations declarees : symetrique ordonnee par id, dirigee dans son sens", async () => {
    await seedPerfWorld("owner-1", PLAN);

    const ids = entityRows().map((e) => e.id);
    const [allyA, allyB] = [ids[2] ?? "", ids[1] ?? ""].sort();
    expect(firstArg(declaredCreateMany)).toEqual({
      data: [
        {
          worldId: "w-perf",
          sourceId: allyA,
          targetId: allyB,
          relationType: "ally",
          customRelationTypeId: null,
          typeKey: "ally",
        },
        {
          worldId: "w-perf",
          sourceId: ids[2],
          targetId: ids[0],
          relationType: "parent",
          customRelationTypeId: null,
          typeKey: "parent",
        },
      ],
    });
  });

  it("n'enfile aucun job de liaison et ecrit tout dans une seule transaction", async () => {
    await seedPerfWorld("owner-1", PLAN);

    expect(enqueue).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
