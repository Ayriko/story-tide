import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { createIntroWorld } from "./world-service";
import { createSeedEntity, type EntityRecord } from "./entity-service";
import { reconcileManualMentions } from "./relation-service";
import { jobQueue } from "@/lib/queue";
import { ENTITY_LINKING_QUEUE } from "@/lib/queue/entity-linking";
import { seedIntroWorld } from "./intro-world-service";

// Fixture reduite (2 entites, 1 mention) plutot que le vrai corpus de 25
// entites Atheraus - ce test verifie l'ORCHESTRATION (2 passages, resolution
// seedRef -> id, appel des vraies fonctions de service), pas le contenu du
// monde d'introduction lui-meme (verifie mecaniquement ailleurs, hors tests
// unitaires - script de generation + verification en conditions reelles).
vi.mock("../../prisma/seed/atheraus.json", () => ({
  default: {
    worldName: "TestWorld",
    entities: [
      {
        seedRef: "seed-a",
        name: "Alpha",
        type: "character",
        aliases: ["A."],
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Alpha mentionne " },
                { type: "mention", attrs: { seedRef: "seed-b", label: "Beta" } },
                { type: "text", text: "." },
              ],
            },
          ],
        },
      },
      {
        seedRef: "seed-b",
        name: "Beta",
        type: "place",
        aliases: [],
        body: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Beta n'a aucune mention." }] },
          ],
        },
      },
    ],
  },
}));

vi.mock("./world-service", () => ({
  createIntroWorld: vi.fn(),
}));

vi.mock("./entity-service", () => ({
  createSeedEntity: vi.fn(),
}));

vi.mock("./relation-service", () => ({
  reconcileManualMentions: vi.fn(),
}));

vi.mock("@/lib/queue", () => ({
  jobQueue: { enqueue: vi.fn() },
}));

const mockedCreateIntroWorld = vi.mocked(createIntroWorld);
const mockedCreateSeedEntity = vi.mocked(createSeedEntity);
const mockedReconcileManualMentions = vi.mocked(reconcileManualMentions);
const mockedEnqueue = vi.mocked(jobQueue.enqueue);

const OWNER_ID = "owner-1";
const WORLD_ID = "intro-world-1";

beforeEach(() => {
  vi.clearAllMocks();
  // @ts-expect-error - seul id/name importent au test, pas la forme complete du modele World.
  mockedCreateIntroWorld.mockResolvedValue({ id: WORLD_ID, name: "TestWorld" });
  mockedCreateSeedEntity.mockImplementation(async (_worldId, input) => {
    // Seuls id/aliases importent aux assertions - cast justifie (convention
    // prisma-mock-partial-select : seuls les champs reellement lus sont fournis).
    return { id: `id-${input.seedRef}`, aliases: input.aliases } as unknown as EntityRecord;
  });
});

describe("seedIntroWorld", () => {
  it("cree le monde puis les entites en 2 passages, resout la mention en id reel, reconcilie MANUAL et enfile les jobs", async () => {
    const result = await seedIntroWorld(OWNER_ID);

    expect(mockedCreateIntroWorld).toHaveBeenCalledWith(OWNER_ID, "TestWorld");
    expect(result).toEqual({ worldId: WORLD_ID });

    // Passage 1 : les 2 entites creees, mention degradee en texte plat (pas
    // d'id reel connu a ce stade).
    const pass1Calls = mockedCreateSeedEntity.mock.calls.filter(
      ([, input]) => input.seedRef === "seed-a",
    );
    expect(pass1Calls.length).toBeGreaterThanOrEqual(1);
    const firstCallForA = pass1Calls[0]?.[1].content as JSONContent;
    const firstParagraph = firstCallForA.content?.[0];
    expect(firstParagraph?.content?.some((node) => node.type === "mention")).toBe(false);
    expect(firstParagraph?.content?.some((node) => node.text === "Beta")).toBe(true);

    // Passage 2 : seedRef "seed-a" re-persiste avec la mention resolue en id reel (id-seed-b).
    const lastCallForA = mockedCreateSeedEntity.mock.calls
      .filter(([, input]) => input.seedRef === "seed-a")
      .at(-1);
    const resolvedContent = lastCallForA?.[1].content as JSONContent;
    const mentionNode = resolvedContent.content?.[0]?.content?.find(
      (node) => node.type === "mention",
    );
    expect(mentionNode?.attrs).toEqual({ id: "id-seed-b", label: "Beta" });

    // seedRef "seed-b" n'a jamais de mention : un seul appel (pas de 2e passage).
    const callsForB = mockedCreateSeedEntity.mock.calls.filter(
      ([, input]) => input.seedRef === "seed-b",
    );
    expect(callsForB).toHaveLength(1);

    // MANUAL reconcilie uniquement pour l'entite porteuse de la mention (Alpha),
    // avec l'id REEL de la cible (Beta).
    expect(mockedReconcileManualMentions).toHaveBeenCalledTimes(1);
    expect(mockedReconcileManualMentions).toHaveBeenCalledWith(OWNER_ID, WORLD_ID, "id-seed-a", [
      "id-seed-b",
    ]);

    // Job de liaison enfile pour CHAQUE entite (2), jamais de Relation AUTO
    // ecrite directement par ce service.
    expect(mockedEnqueue).toHaveBeenCalledTimes(2);
    expect(mockedEnqueue).toHaveBeenCalledWith(
      ENTITY_LINKING_QUEUE,
      { worldId: WORLD_ID, entityId: "id-seed-a" },
      { singletonKey: "id-seed-a" },
    );
    expect(mockedEnqueue).toHaveBeenCalledWith(
      ENTITY_LINKING_QUEUE,
      { worldId: WORLD_ID, entityId: "id-seed-b" },
      { singletonKey: "id-seed-b" },
    );
  });
});
