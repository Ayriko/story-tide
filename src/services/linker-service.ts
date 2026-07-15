import { prisma } from "@/db/client";
import type { Pattern } from "@/lib/linker/aho-corasick";

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
