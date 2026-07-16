import { prisma } from "@/db/client";
import { RelationOrigin } from "@/generated/prisma/client";
import { AhoCorasick, type Pattern } from "@/lib/linker/aho-corasick";
import { resolveLinks } from "@/lib/linker/resolve-links";

// Dictionnaire de liaison d'un monde : un motif par nom d'entite + un motif
// par alias (spec §4.4.1 - "aliases[] fait partie du dictionnaire au meme
// titre que name", regle dure CLAUDE.md). Pas d'autorisation ownerId ici :
// ce service est appele par le worker (job de liaison), qui ne porte aucune
// session - l'autorisation a deja eu lieu a l'enfilage, cote Server Action
// (meme confiance que LinkingJob { worldId, entityId } dans src/worker).
export async function buildDictionary(worldId: string): Promise<Pattern[]> {
  const entities = await prisma.entity.findMany({
    where: { worldId },
    select: { id: true, name: true, aliases: true },
  });

  const patterns: Pattern[] = [];
  for (const entity of entities) {
    patterns.push({ entityId: entity.id, term: entity.name });
    for (const alias of entity.aliases) {
      patterns.push({ entityId: entity.id, term: alias });
    }
  }
  return patterns;
}

// Scanne le plainText d'une fiche et fait converger les Relation origin=AUTO
// sortantes de cette fiche vers ce qui est reellement mentionne (spec §4.4,
// points 4-6). Jamais appele avec une session utilisateur (worker) : aucune
// verification d'autorisation ici, la confiance vient de l'enfilage (Server
// Action deja authentifiee/autorisee avant d'enqueue le job).
export async function scanAndLinkEntity(worldId: string, entityId: string): Promise<void> {
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, worldId },
    select: { plainText: true },
  });
  if (!entity) {
    // Fiche supprimee entre l'enfilage et le traitement du job : rien a faire.
    return;
  }

  const patterns = await buildDictionary(worldId);
  const matches = new AhoCorasick(patterns).search(entity.plainText);

  const ignoredRows = await prisma.linkIgnore.findMany({
    where: { entityId },
    select: { targetId: true },
  });
  const ignoredTargets = new Set(ignoredRows.map((row) => row.targetId));

  // Regroupement par occurrence, exclusion de l'ambiguite/auto-mention/
  // LinkIgnore : logique partagee avec le surlignage live cote client (meme
  // fonction pure), pour que ce qui est surligne soit exactement ce qui
  // devient une Relation - voir src/lib/linker/resolve-links.ts.
  const { targetIds: desiredTargets } = resolveLinks(matches, {
    selfEntityId: entityId,
    ignoredTargetIds: ignoredTargets,
  });

  const existingAuto = await prisma.relation.findMany({
    where: { sourceId: entityId, origin: RelationOrigin.AUTO },
    select: { targetId: true },
  });
  const existingTargets = new Set(existingAuto.map((row) => row.targetId));

  const toAdd = [...desiredTargets].filter((targetId) => !existingTargets.has(targetId));
  const toRemove = [...existingTargets].filter((targetId) => !desiredTargets.has(targetId));

  if (toAdd.length === 0 && toRemove.length === 0) {
    return;
  }

  // Transaction : le diff s'applique en un bloc, jamais partiellement. Les
  // Relation origin=MANUAL ne sont jamais lues ni ecrites ici - impossible de
  // les ecraser par construction (regle dure CLAUDE.md).
  await prisma.$transaction([
    ...(toAdd.length > 0
      ? [
          prisma.relation.createMany({
            data: toAdd.map((targetId) => ({
              worldId,
              sourceId: entityId,
              targetId,
              origin: RelationOrigin.AUTO,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
    ...(toRemove.length > 0
      ? [
          prisma.relation.deleteMany({
            where: { sourceId: entityId, origin: RelationOrigin.AUTO, targetId: { in: toRemove } },
          }),
        ]
      : []),
  ]);
}
