import type { JSONContent } from "@tiptap/core";
import { createIntroWorld } from "./world-service";
import { createSeedEntity } from "./entity-service";
import { reconcileManualMentions } from "./relation-service";
import {
  extractMentionedEntityIds,
  extractPlainText,
  normalizeContentText,
} from "@/lib/tiptap-content";
import { jobQueue } from "@/lib/queue";
import { ENTITY_LINKING_QUEUE } from "@/lib/queue/entity-linking";
import atherausSeed from "../../prisma/seed/atheraus.json";

// Format d'AUTORAGE des mentions dans le JSON de seed (KAN-35) : `seedRef` de
// la cible plutot qu'un `id` reel, puisque les ids Prisma n'existent qu'apres
// insertion (ordre creation-avant-lien) - jamais un id en dur dans le JSON.
interface SeedMentionAttrs {
  seedRef: string;
  label: string;
}

interface SeedEntity {
  seedRef: string;
  name: string;
  type: string;
  aliases: string[];
  body: JSONContent;
}

const seedData = atherausSeed as { worldName: string; entities: SeedEntity[] };

// Remplace chaque noeud mention {attrs:{seedRef,label}} par un noeud texte
// plat portant le meme label - utilise au PREMIER passage (avant que les ids
// reels n'existent), pour que le contenu persiste soit un Tiptap valide
// independamment du second passage (jamais de mention a moitie ecrite en
// base, meme transitoirement).
function stripMentionsToText(node: JSONContent): JSONContent {
  if (node.type === "mention" && node.attrs && "seedRef" in node.attrs) {
    return { type: "text", text: (node.attrs as unknown as SeedMentionAttrs).label };
  }
  const clone: JSONContent = { ...node };
  if (clone.content) {
    clone.content = clone.content.map(stripMentionsToText);
  }
  return clone;
}

// Remplace chaque noeud mention {attrs:{seedRef,label}} par un noeud mention
// Tiptap reel {attrs:{id,label}} - utilise au SECOND passage, une fois les 25
// entites creees et leurs ids reels connus (seedRefToId).
function resolveMentions(node: JSONContent, seedRefToId: Map<string, string>): JSONContent {
  if (node.type === "mention" && node.attrs && "seedRef" in node.attrs) {
    const attrs = node.attrs as unknown as SeedMentionAttrs;
    const id = seedRefToId.get(attrs.seedRef);
    if (!id) {
      // Erreur de coherence du JSON de seed (seedRef cible inexistant) -
      // jamais avalee : un lien manuel casse silencieusement serait pire
      // qu'un echec bruyant a la generation.
      throw new Error(`[intro-world] mention vers un seedRef inconnu : ${attrs.seedRef}`);
    }
    return { type: "mention", attrs: { id, label: attrs.label } };
  }
  const clone: JSONContent = { ...node };
  if (clone.content) {
    clone.content = clone.content.map((child) => resolveMentions(child, seedRefToId));
  }
  return clone;
}

function containsMention(node: JSONContent): boolean {
  if (node.type === "mention") {
    return true;
  }
  return (node.content ?? []).some(containsMention);
}

// Seed complet du monde d'introduction "Atheraus" (KAN-35) pour un
// proprietaire donne - fonction PARTAGEE entre le CLI de verification locale
// (prisma/seed/run.ts) et l'inscription (chaque utilisateur obtient sa propre
// copie independante, ids frais - aucun monde partage entre comptes,
// World.ownerId etant un FK non-nullable reel). Passe uniquement par la
// couche service (createIntroWorld, createSeedEntity, reconcileManualMentions)
// - aucun acces `prisma` direct dans ce fichier.
//
// Aucune Relation creee ici en dehors des 3 MANUAL (mentions manuelles du
// corpus) : les Relation AUTO naissent du passage du worker apres insertion -
// c'est la demonstration elle-meme (contrat de seed §1). D'ou l'enfilage
// explicite d'un job de liaison par entite : le seed ne passe pas par
// saveEntityContentAction (qui enfile normalement ce job a chaque sauvegarde).
export async function seedIntroWorld(ownerId: string): Promise<{ worldId: string }> {
  const world = await createIntroWorld(ownerId, seedData.worldName);

  const seedRefToId = new Map<string, string>();

  // Passage 1 : cree/met a jour les 25 entites. Les mentions sont degradees
  // en texte plat (stripMentionsToText) - contenu deja valide independamment
  // du passage 2, ids des 25 entites desormais connus.
  for (const entitySeed of seedData.entities) {
    const strippedBody = stripMentionsToText(entitySeed.body);
    const normalizedBody = normalizeContentText(strippedBody);
    const entity = await createSeedEntity(world.id, {
      seedRef: entitySeed.seedRef,
      name: entitySeed.name,
      type: entitySeed.type,
      aliases: entitySeed.aliases,
      content: normalizedBody,
      plainText: extractPlainText(normalizedBody),
    });
    seedRefToId.set(entitySeed.seedRef, entity.id);
  }

  // Passage 2 : pour les entites dont le corps porte reellement une mention,
  // resout seedRef -> id reel et re-persiste le contenu definitif, puis
  // reconcilie les Relation origin=MANUAL par le chemin normal
  // (reconcileManualMentions, jamais une ecriture directe de Relation).
  for (const entitySeed of seedData.entities) {
    if (!containsMention(entitySeed.body)) {
      continue;
    }
    const entityId = seedRefToId.get(entitySeed.seedRef);
    if (!entityId) {
      throw new Error(`[intro-world] entite introuvable apres creation : ${entitySeed.seedRef}`);
    }
    const resolvedBody = resolveMentions(entitySeed.body, seedRefToId);
    const normalizedBody = normalizeContentText(resolvedBody);
    await createSeedEntity(world.id, {
      seedRef: entitySeed.seedRef,
      name: entitySeed.name,
      type: entitySeed.type,
      aliases: entitySeed.aliases,
      content: normalizedBody,
      plainText: extractPlainText(normalizedBody),
    });

    // Meme fonction que le chemin normal de sauvegarde (saveEntityContentAction) :
    // extrait les ids reellement references par un noeud mention de CE corps.
    const mentionedIds = extractMentionedEntityIds(resolvedBody);
    await reconcileManualMentions(ownerId, world.id, entityId, mentionedIds);
  }

  // Enfilage du job de liaison pour les 25 entites - le worker produira les
  // Relation origin=AUTO a son prochain passage, jamais ici (contrat §1).
  for (const id of seedRefToId.values()) {
    await jobQueue.enqueue(
      ENTITY_LINKING_QUEUE,
      { worldId: world.id, entityId: id },
      { singletonKey: id },
    );
  }

  return { worldId: world.id };
}
