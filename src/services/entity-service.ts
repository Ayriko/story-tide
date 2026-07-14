import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/db/client";
import type { CreateEntityInput, UpdateEntityInput } from "@/lib/entity-schemas";
import { EMPTY_CONTENT, extractPlainText } from "@/lib/tiptap-content";
import type { Entity } from "@/generated/prisma/client";
import { getWorld } from "./world-service";

export class EntityNotFoundError extends Error {
  constructor() {
    super("Fiche introuvable.");
    this.name = "EntityNotFoundError";
  }
}

// Autorisation en cascade : appartenance au monde verifiee via world-service
// (reutilise getWorld, jamais duplique) avant tout acces a une entite - une
// fiche d'un monde qui n'appartient pas au proprietaire n'est jamais atteignable,
// meme avec un entityId valide (OWASP A01).

export async function createEntity(
  ownerId: string,
  worldId: string,
  input: CreateEntityInput,
): Promise<Entity> {
  await getWorld(ownerId, worldId);
  return prisma.entity.create({
    data: {
      worldId,
      name: input.name,
      type: input.type,
      aliases: input.aliases,
      content: EMPTY_CONTENT,
      plainText: extractPlainText(EMPTY_CONTENT),
    },
  });
}

export async function listEntities(ownerId: string, worldId: string): Promise<Entity[]> {
  await getWorld(ownerId, worldId);
  return prisma.entity.findMany({ where: { worldId }, orderBy: { createdAt: "desc" } });
}

export async function getEntity(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<Entity> {
  await getWorld(ownerId, worldId);
  const entity = await prisma.entity.findFirst({ where: { id: entityId, worldId } });
  if (!entity) {
    throw new EntityNotFoundError();
  }
  return entity;
}

export async function updateEntity(
  ownerId: string,
  worldId: string,
  entityId: string,
  input: UpdateEntityInput,
): Promise<Entity> {
  const entity = await getEntity(ownerId, worldId, entityId);
  return prisma.entity.update({
    where: { id: entity.id },
    data: { name: input.name, type: input.type, aliases: input.aliases },
  });
}

// Contenu + plainText deja valides/extraits en amont (src/lib/tiptap-content.ts)
// avant d'appeler ce service - ce dernier ne fait que persister.
export async function updateEntityContent(
  ownerId: string,
  worldId: string,
  entityId: string,
  content: JSONContent,
  plainText: string,
): Promise<Entity> {
  const entity = await getEntity(ownerId, worldId, entityId);
  return prisma.entity.update({
    where: { id: entity.id },
    data: { content, plainText },
  });
}

export async function deleteEntity(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<void> {
  const entity = await getEntity(ownerId, worldId, entityId);
  await prisma.entity.delete({ where: { id: entity.id } });
}
