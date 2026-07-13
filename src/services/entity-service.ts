import { prisma } from "@/db/client";
import type { CreateEntityInput, UpdateEntityInput } from "@/lib/entity-schemas";
import type { Entity } from "@/generated/prisma/client";
import { getWorld } from "./world-service";

export class EntityNotFoundError extends Error {
  constructor() {
    super("Fiche introuvable.");
    this.name = "EntityNotFoundError";
  }
}

// Document ProseMirror vide - l'editeur Tiptap (etape suivante) remplacera ce
// contenu au premier enregistrement reel. plainText vide en attendant l'extraction.
const EMPTY_CONTENT = { type: "doc", content: [] };

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
      plainText: "",
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

export async function deleteEntity(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<void> {
  const entity = await getEntity(ownerId, worldId, entityId);
  await prisma.entity.delete({ where: { id: entity.id } });
}
