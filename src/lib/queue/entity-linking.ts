// Contrat partage entre le producteur (Server Action de sauvegarde de fiche,
// src/actions/entity-content.ts) et le consommateur (worker, src/worker/index.ts)
// de la file de liaison automatique (moteur Aho-Corasick, spec §4.4.3). Extrait
// dans un seul fichier pour que le nom de file et la forme du job ne puissent
// jamais diverger entre les deux cotes.
export const ENTITY_LINKING_QUEUE = "entity-linking";

export interface EntityLinkingJob {
  worldId: string;
  entityId: string;
}
