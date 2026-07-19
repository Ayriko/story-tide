import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/db/client";
import type { CreateEntityInput, UpdateEntityInput } from "@/lib/entity-schemas";
import { EMPTY_CONTENT, extractPlainText } from "@/lib/tiptap-content";
import { normalizeForMatch } from "@/lib/linker/normalize";
import { FREE_ENTITY_LIMIT_PER_WORLD } from "@/lib/quotas";
import type { Alias, Entity } from "@/generated/prisma/client";
import { WorldOrigin } from "@/generated/prisma/client";
import { getWorld } from "./world-service";

export type EntitySearchResult = { id: string; name: string; type: string };

// Contrat de retour uniforme de toute la couche service : aliases reste un
// string[] pour les appelants (actions/UI/tests), meme si la persistance
// (KAN-18) est desormais une table Alias dediee, pas un scalaire.
export type EntityRecord = Entity & { aliases: string[] };

function toEntityRecord(entity: Entity & { aliases: Alias[] }): EntityRecord {
  return { ...entity, aliases: entity.aliases.map((alias) => alias.value) };
}

export class EntityNotFoundError extends Error {
  constructor() {
    super("Fiche introuvable.");
    this.name = "EntityNotFoundError";
  }
}

export class EntityQuotaExceededError extends Error {
  constructor() {
    super("Limite de fiches atteinte pour ce monde (offre gratuite : 50 maximum).");
    this.name = "EntityQuotaExceededError";
  }
}

// Autorisation en cascade : appartenance au monde verifiee via world-service
// (reutilise getWorld, jamais duplique) avant tout acces a une entite - une
// fiche d'un monde qui n'appartient pas au proprietaire n'est jamais atteignable,
// meme avec un entityId valide (OWASP A01).

// Quota saute entierement (aucune requete count) si le monde n'est pas USER
// (INTRO/DEMO, KAN-18) - getWorld a deja renvoye l'objet complet, aucune
// requete supplementaire necessaire pour lire ce champ.
export async function createEntity(
  ownerId: string,
  worldId: string,
  input: CreateEntityInput,
): Promise<EntityRecord> {
  const world = await getWorld(ownerId, worldId);
  if (world.origin === WorldOrigin.USER) {
    const count = await prisma.entity.count({ where: { worldId } });
    if (count >= FREE_ENTITY_LIMIT_PER_WORLD) {
      throw new EntityQuotaExceededError();
    }
  }
  const entity = await prisma.entity.create({
    data: {
      worldId,
      name: input.name,
      type: input.type,
      aliases: {
        create: input.aliases.map((value) => ({ value, normalized: normalizeForMatch(value) })),
      },
      content: EMPTY_CONTENT,
      plainText: extractPlainText(EMPTY_CONTENT),
    },
    include: { aliases: true },
  });
  return toEntityRecord(entity);
}

export async function listEntities(ownerId: string, worldId: string): Promise<EntityRecord[]> {
  await getWorld(ownerId, worldId);
  const entities = await prisma.entity.findMany({
    where: { worldId },
    include: { aliases: true },
    orderBy: { createdAt: "desc" },
  });
  return entities.map(toEntityRecord);
}

// Recherche basique (KAN-17, spec §2.8) : filtre en memoire sur name+aliases
// apres chargement scope worldId. Prisma n'offre aucun operateur substring
// insensible-casse portable sur une relation - le filtrage reste cote TS,
// mais `Alias.normalized` (KAN-18) est deja precalcule au moment de l'ecriture
// (createEntity/updateEntity), donc plus besoin de renormaliser chaque alias
// ici, seulement le nom et la requete. Suffisant pour le volume de fiches
// d'un monde au MVP ; le full-text (index dedie) est P1, hors perimetre.
export async function searchEntities(
  ownerId: string,
  worldId: string,
  query: string,
): Promise<EntitySearchResult[]> {
  await getWorld(ownerId, worldId);
  const needle = normalizeForMatch(query);
  const entities = await prisma.entity.findMany({
    where: { worldId },
    select: {
      id: true,
      name: true,
      type: true,
      aliases: { select: { normalized: true }, where: { active: true } },
    },
    orderBy: { name: "asc" },
  });
  return entities
    .filter(
      (entity) =>
        normalizeForMatch(entity.name).includes(needle) ||
        entity.aliases.some((alias) => alias.normalized.includes(needle)),
    )
    .map(({ id, name, type }) => ({ id, name, type }));
}

export async function getEntity(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<EntityRecord> {
  await getWorld(ownerId, worldId);
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, worldId },
    include: { aliases: true },
  });
  if (!entity) {
    throw new EntityNotFoundError();
  }
  return toEntityRecord(entity);
}

// Remplacement complet des alias a chaque update (meme semantique qu'avant
// KAN-18, ou tout le tableau etait deja reecrit) : deleteMany + create dans
// la meme ecriture imbriquee, transaction implicite Prisma.
export async function updateEntity(
  ownerId: string,
  worldId: string,
  entityId: string,
  input: UpdateEntityInput,
): Promise<EntityRecord> {
  const entity = await getEntity(ownerId, worldId, entityId);
  const updated = await prisma.entity.update({
    where: { id: entity.id },
    data: {
      name: input.name,
      type: input.type,
      aliases: {
        deleteMany: {},
        create: input.aliases.map((value) => ({ value, normalized: normalizeForMatch(value) })),
      },
    },
    include: { aliases: true },
  });
  return toEntityRecord(updated);
}

// Contenu + plainText deja valides/extraits en amont (src/lib/tiptap-content.ts)
// avant d'appeler ce service - ce dernier ne fait que persister.
export async function updateEntityContent(
  ownerId: string,
  worldId: string,
  entityId: string,
  content: JSONContent,
  plainText: string,
): Promise<EntityRecord> {
  const entity = await getEntity(ownerId, worldId, entityId);
  const updated = await prisma.entity.update({
    where: { id: entity.id },
    data: { content, plainText },
    include: { aliases: true },
  });
  return toEntityRecord(updated);
}

export async function deleteEntity(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<void> {
  const entity = await getEntity(ownerId, worldId, entityId);
  await prisma.entity.delete({ where: { id: entity.id } });
}
