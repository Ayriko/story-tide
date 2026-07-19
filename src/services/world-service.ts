import { prisma } from "@/db/client";
import { slugify } from "@/lib/slugify";
import { FREE_WORLD_LIMIT } from "@/lib/quotas";
import { storage } from "@/lib/storage";
import type { CreateWorldInput, UpdateWorldInput } from "@/lib/world-schemas";
import type { World } from "@/generated/prisma/client";
import { WorldOrigin } from "@/generated/prisma/client";

export class WorldNotFoundError extends Error {
  constructor() {
    super("Monde introuvable.");
    this.name = "WorldNotFoundError";
  }
}

export class WorldQuotaExceededError extends Error {
  constructor() {
    super("Limite de mondes atteinte pour l'offre gratuite (3 maximum).");
    this.name = "WorldQuotaExceededError";
  }
}

// Trouve un slug libre pour ce proprietaire a partir d'une base (suffixe -2,
// -3... en cas de collision - @@unique([ownerId, slug])). ignoreWorldId permet
// de renommer un monde sans se bloquer sur son propre slug actuel.
async function resolveUniqueSlug(
  ownerId: string,
  base: string,
  ignoreWorldId?: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const existing = await prisma.world.findUnique({
      where: { ownerId_slug: { ownerId, slug: candidate } },
      select: { id: true },
    });

    if (!existing || existing.id === ignoreWorldId) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

// Quota verifie avant resolveUniqueSlug (evite un travail inutile si la
// creation sera de toute facon refusee). origin=USER explicite : un monde
// INTRO (KAN-35) ou DEMO (compte de demonstration jury) ne compte jamais
// parmi les FREE_WORLD_LIMIT mondes du proprietaire.
export async function createWorld(ownerId: string, input: CreateWorldInput): Promise<World> {
  const count = await prisma.world.count({ where: { ownerId, origin: WorldOrigin.USER } });
  if (count >= FREE_WORLD_LIMIT) {
    throw new WorldQuotaExceededError();
  }
  const slug = await resolveUniqueSlug(ownerId, slugify(input.name));
  return prisma.world.create({ data: { ownerId, name: input.name, slug } });
}

export async function listWorlds(ownerId: string): Promise<World[]> {
  return prisma.world.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" } });
}

// Appartenance verifiee ici (filtre ownerId), jamais seulement en UI (OWASP A01).
// Un monde d'autrui rend la meme erreur qu'un monde inexistant : pas de fuite
// d'existence.
export async function getWorld(ownerId: string, worldId: string): Promise<World> {
  const world = await prisma.world.findFirst({ where: { id: worldId, ownerId } });
  if (!world) {
    throw new WorldNotFoundError();
  }
  return world;
}

export async function getWorldBySlug(ownerId: string, slug: string): Promise<World> {
  const world = await prisma.world.findUnique({ where: { ownerId_slug: { ownerId, slug } } });
  if (!world) {
    throw new WorldNotFoundError();
  }
  return world;
}

export async function updateWorld(
  ownerId: string,
  worldId: string,
  input: UpdateWorldInput,
): Promise<World> {
  const world = await getWorld(ownerId, worldId);
  const slug = await resolveUniqueSlug(ownerId, slugify(input.name), world.id);
  return prisma.world.update({ where: { id: world.id }, data: { name: input.name, slug } });
}

// RGPD ("purge monde + binaires") : les objets MinIO ne sont PAS supprimes par
// la cascade Prisma (onDelete: Cascade ne connait que les lignes DB, jamais le
// stockage externe) - il faut donc les purger explicitement avant de
// supprimer le monde. Best-effort (decision Aymeric, KAN-16) : un echec de
// storage.delete est loggue (jamais avale) mais ne bloque pas la suppression
// du monde - un objet MinIO orphelin sans reference DB est une donnee inerte,
// rattrapable par un futur job de menage, plutot qu'un incident de stockage
// transitoire qui empecherait un utilisateur de supprimer son monde.
export async function deleteWorld(ownerId: string, worldId: string): Promise<void> {
  const world = await getWorld(ownerId, worldId);
  const images = await prisma.image.findMany({
    where: { worldId: world.id },
    select: { key: true },
  });
  await Promise.all(
    images.map(async (image) => {
      try {
        await storage.delete(image.key);
      } catch (error) {
        console.error(`[world] Purge de l'image ${image.key} échouée :`, error);
      }
    }),
  );
  await prisma.world.delete({ where: { id: world.id } });
}
