import { randomUUID } from "node:crypto";
import { prisma } from "@/db/client";
import { RelationOrigin } from "@/generated/prisma/client";
import {
  generatePerfWorld,
  PERF_WORLD,
  perfEntityContent,
  type PerfWorldPlan,
} from "@/lib/perf-world-generator";
import { RELATION_TYPE_REFERENCE } from "@/lib/relation-types";
import { extractPlainText } from "@/lib/tiptap-content";

// Monde de test de performance (KAN-85) : outil de DEVELOPPEMENT, appele
// uniquement par prisma/seed/perf.ts apres la garde de base locale. Ecrit
// directement les relations (AUTO/MANUAL et declarees) SANS passer par le
// worker : aucun job n'est enfile, et contentVersion = scannedVersion (0)
// garde le worker a l'ecart - le texte de chaque entree cite exactement ses
// cibles, un re-scan ulterieur retrouverait les memes liens AUTO.

// 300 entrees + ~750 relations : au-dela du delai par defaut (5 s) d'une
// transaction interactive sur un poste de dev.
const TRANSACTION_TIMEOUT_MS = 60_000;

export type PerfWorldSummary = {
  worldId: string;
  entities: number;
  textLinks: number;
  declared: number;
};

export async function seedPerfWorld(
  ownerId: string,
  plan: PerfWorldPlan = generatePerfWorld(),
): Promise<PerfWorldSummary> {
  const ids = plan.entities.map(() => randomUUID());
  const idOf = (index: number): string => {
    const id = ids[index];
    if (id === undefined) {
      throw new RangeError(`Entree ${index} absente du plan`);
    }
    return id;
  };
  const nameOf = (index: number): string => plan.entities[index]?.name ?? "";

  const targetsBySource = new Map<number, Parameters<typeof perfEntityContent>[1]>();
  for (const link of plan.textLinks) {
    const targets = targetsBySource.get(link.source) ?? [];
    targets.push(
      link.origin === "AUTO"
        ? { kind: "AUTO", name: nameOf(link.target) }
        : { kind: "MANUAL", id: idOf(link.target), name: nameOf(link.target) },
    );
    targetsBySource.set(link.source, targets);
  }

  const worldId = await prisma.$transaction(
    async (tx) => {
      // Recree a l'identique : suppression du monde precedent (cascade sur
      // entrees, relations, tableau et positions), puis creation.
      await tx.world.deleteMany({ where: { ownerId, slug: PERF_WORLD.slug } });
      const world = await tx.world.create({
        data: { ownerId, name: PERF_WORLD.name, slug: PERF_WORLD.slug },
        select: { id: true },
      });

      await tx.entity.createMany({
        data: plan.entities.map((entity, index) => {
          const content = perfEntityContent(entity.name, targetsBySource.get(index) ?? []);
          return {
            id: idOf(index),
            worldId: world.id,
            name: entity.name,
            type: entity.type,
            seedRef: entity.ref,
            content,
            plainText: extractPlainText(content),
          };
        }),
      });

      await tx.relation.createMany({
        data: plan.textLinks.map((link) => ({
          worldId: world.id,
          sourceId: idOf(link.source),
          targetId: idOf(link.target),
          origin: link.origin === "AUTO" ? RelationOrigin.AUTO : RelationOrigin.MANUAL,
        })),
      });

      await tx.declaredRelation.createMany({
        data: plan.declared.map((relation) => {
          const a = idOf(relation.source);
          const b = idOf(relation.target);
          // Meme regle que createDeclaredRelation : un type symetrique est
          // stocke une seule fois, extremites ordonnees par id.
          const symmetric = RELATION_TYPE_REFERENCE[relation.type].inverseLabel === null;
          const ordered = symmetric ? a < b : true;
          return {
            worldId: world.id,
            sourceId: ordered ? a : b,
            targetId: ordered ? b : a,
            relationType: relation.type,
            customRelationTypeId: null,
            typeKey: relation.type,
          };
        }),
      });

      return world.id;
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );

  return {
    worldId,
    entities: plan.entities.length,
    textLinks: plan.textLinks.length,
    declared: plan.declared.length,
  };
}
