import { prisma } from "@/db/client";
import { getWorld } from "./world-service";

// Autorisation en cascade (meme pattern que entity-service.ts) : appartenance
// au monde verifiee via getWorld avant tout acces aux LinkIgnore/Relation.
export async function getIgnoredTargetIds(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<string[]> {
  await getWorld(ownerId, worldId);
  const rows = await prisma.linkIgnore.findMany({
    where: { entityId },
    select: { targetId: true },
  });
  return rows.map((row) => row.targetId);
}
