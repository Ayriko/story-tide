import { jobQueue } from "@/lib/queue";
import { ENTITY_LINKING_QUEUE, type EntityLinkingJob } from "@/lib/queue/entity-linking";
import { scanAndLinkEntity } from "@/services/linker-service";

async function main(): Promise<void> {
  await jobQueue.work<EntityLinkingJob>(ENTITY_LINKING_QUEUE, async (data, job) => {
    console.log(`[worker] job ${job.id} recu pour la file ${ENTITY_LINKING_QUEUE}`, data);
    await scanAndLinkEntity(data.worldId, data.entityId);
  });

  console.log(`[worker] a l'ecoute de la file "${ENTITY_LINKING_QUEUE}"`);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`[worker] ${signal} recu, arret gracieux...`);
  await jobQueue.stop();
  process.exit(0);
}

process.on("SIGTERM", (signal) => void shutdown(signal));
process.on("SIGINT", (signal) => void shutdown(signal));

main().catch((error: unknown) => {
  console.error("[worker] echec au demarrage", error);
  process.exit(1);
});
