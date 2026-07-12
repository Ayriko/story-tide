import { jobQueue } from "@/lib/queue";

// Nom de la file des jobs de liaison automatique (moteur Aho-Corasick).
// Le producteur (Server Action de sauvegarde de fiche) enverra un job par
// fiche modifiee ; la policy "short" de l'adaptateur garantit un seul job en
// attente par fiche (cf. ADR-0005, spec §4.4.3).
const LINKING_QUEUE = "entity-linking";

interface LinkingJob {
  worldId: string;
  entityId: string;
}

async function main(): Promise<void> {
  await jobQueue.work<LinkingJob>(LINKING_QUEUE, async (data, job) => {
    // TODO (bloc produit) : compiler/charger l'automate du monde et executer le
    // scan de liaison, puis upsert des Relation origin=AUTO. Pour l'instant le
    // worker se contente d'accuser reception : l'infrastructure (file + arret
    // gracieux + image Docker) est en place et verifiable de bout en bout.
    console.log(`[worker] job ${job.id} recu pour la file ${LINKING_QUEUE}`, data);
  });

  console.log(`[worker] a l'ecoute de la file "${LINKING_QUEUE}"`);
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
