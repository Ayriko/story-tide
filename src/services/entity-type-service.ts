import { cache } from "react";
import { prisma } from "@/db/client";
import { Prisma } from "@/generated/prisma/client";
import { ENTITY_TYPE_REFERENCE, ENTITY_TYPES } from "@/lib/entity-schemas";
import { CUSTOM_ENTITY_TYPE, customTypeKey, parseTypeKey } from "@/lib/entity-types";
import type { WorldTypeCatalog } from "@/lib/entity-types";
import type { CustomTypeInput, ReassignMap } from "@/lib/entity-type-schemas";
import { normalizeForMatch } from "@/lib/linker/normalize";
import { WorldNotFoundError, getWorld } from "./world-service";

// Type personnalise inexistant OU d'un autre monde : meme erreur (OWASP A01).
export class CustomTypeNotFoundError extends Error {
  constructor() {
    super("Type introuvable.");
    this.name = "CustomTypeNotFoundError";
  }
}

export class CustomTypeLabelTakenError extends Error {
  constructor(options?: { cause: unknown }) {
    super("Ce libellé est déjà utilisé dans ce monde.", options);
    this.name = "CustomTypeLabelTakenError";
  }
}

export class LastSelectableTypeError extends Error {
  constructor() {
    super("Au moins un type doit rester proposé dans ce monde.");
    this.name = "LastSelectableTypeError";
  }
}

export class ReassignMapStaleError extends Error {
  constructor(options?: { cause: unknown }) {
    super("La liste a changé, recharge la page.", options);
    this.name = "ReassignMapStaleError";
  }
}

// Catalogue des types d'un monde (KAN-81, ADR-0030) : types personnalises +
// natifs masques, en UNE requete qui verifie aussi l'appartenance (filtre
// ownerId, meme erreur qu'un monde inexistant - OWASP A01). cache() de React :
// le layout du monde et ses pages serveur l'appellent chacun, une seule
// requete par rendu serveur, aucune par entree.
export const getWorldTypeCatalog = cache(
  async (ownerId: string, worldId: string): Promise<WorldTypeCatalog> => {
    const world = await prisma.world.findFirst({
      where: { id: worldId, ownerId },
      select: {
        hiddenEntityTypes: true,
        customEntityTypes: {
          select: { id: true, label: true, group: true, icon: true },
          orderBy: { label: "asc" },
        },
      },
    });
    if (!world) {
      throw new WorldNotFoundError();
    }
    return { custom: world.customEntityTypes, hidden: world.hiddenEntityTypes };
  },
);

// Cles de comparaison des 26 libelles natifs : « personnage », « personnagé »
// ou « PERSONNAGE » sont tous refuses comme libelle personnalise.
const NATIVE_LABEL_KEYS = new Set(
  ENTITY_TYPES.map((type) => normalizeForMatch(ENTITY_TYPE_REFERENCE[type].label)),
);

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

// Unicite du libelle dans le monde, insensible a la casse et aux accents :
// contre les natifs ici, contre les autres personnalises ici ET par l'index
// unique (worldId, labelKey) en filet (course entre deux onglets -> P2002).
async function assertLabelFree(worldId: string, labelKey: string, exceptId?: string) {
  if (NATIVE_LABEL_KEYS.has(labelKey)) {
    throw new CustomTypeLabelTakenError();
  }
  const existing = await prisma.customEntityType.findFirst({
    where: { worldId, labelKey, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new CustomTypeLabelTakenError();
  }
}

function labelFields(label: string) {
  const nfc = label.normalize("NFC");
  return { label: nfc, labelKey: normalizeForMatch(nfc) };
}

export async function createCustomType(ownerId: string, worldId: string, input: CustomTypeInput) {
  await getWorld(ownerId, worldId);
  const { label, labelKey } = labelFields(input.label);
  await assertLabelFree(worldId, labelKey);
  try {
    return await prisma.customEntityType.create({
      data: { worldId, label, labelKey, group: input.group, icon: input.icon },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CustomTypeLabelTakenError({ cause: error });
    }
    throw error;
  }
}

async function getCustomType(worldId: string, typeId: string) {
  const customType = await prisma.customEntityType.findFirst({
    where: { id: typeId, worldId },
    select: { id: true },
  });
  if (!customType) {
    throw new CustomTypeNotFoundError();
  }
  return customType;
}

export async function updateCustomType(
  ownerId: string,
  worldId: string,
  typeId: string,
  input: CustomTypeInput,
) {
  await getWorld(ownerId, worldId);
  await getCustomType(worldId, typeId);
  const { label, labelKey } = labelFields(input.label);
  await assertLabelFree(worldId, labelKey, typeId);
  try {
    return await prisma.customEntityType.update({
      where: { id: typeId },
      data: { label, labelKey, group: input.group, icon: input.icon },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CustomTypeLabelTakenError({ cause: error });
    }
    throw error;
  }
}

// Masquer un type natif : ses entrees le gardent et l'affichent, il n'est
// seulement plus propose a la creation. Garde serveur : au moins un type
// proposable (natif non masque ou personnalise) doit rester dans le monde.
export async function setNativeTypeHidden(
  ownerId: string,
  worldId: string,
  type: string,
  hidden: boolean,
): Promise<void> {
  const world = await getWorld(ownerId, worldId);
  const next = hidden
    ? Array.from(new Set([...world.hiddenEntityTypes, type]))
    : world.hiddenEntityTypes.filter((hiddenType) => hiddenType !== type);
  if (hidden) {
    const visibleNatives = ENTITY_TYPES.filter((native) => !next.includes(native)).length;
    if (visibleNatives === 0) {
      const customCount = await prisma.customEntityType.count({ where: { worldId } });
      if (customCount === 0) {
        throw new LastSelectableTypeError();
      }
    }
  }
  await prisma.world.update({ where: { id: world.id }, data: { hiddenEntityTypes: next } });
}

// Nombre d'entrees par cle de type resolue (native ou `custom:<id>`) - un
// seul groupBy, pour la page de parametres.
export async function getTypeUsage(
  ownerId: string,
  worldId: string,
): Promise<Record<string, number>> {
  await getWorld(ownerId, worldId);
  const rows = await prisma.entity.groupBy({
    by: ["type", "customTypeId"],
    where: { worldId },
    _count: { _all: true },
  });
  const usage: Record<string, number> = {};
  for (const row of rows) {
    const key = row.customTypeId ? customTypeKey(row.customTypeId) : row.type;
    usage[key] = (usage[key] ?? 0) + row._count._all;
  }
  return usage;
}

// Entrees de chaque type personnalise du monde (fenetre de reaffectation).
export async function listCustomTypeEntries(
  ownerId: string,
  worldId: string,
): Promise<Record<string, { id: string; name: string }[]>> {
  await getWorld(ownerId, worldId);
  const entities = await prisma.entity.findMany({
    where: { worldId, type: CUSTOM_ENTITY_TYPE },
    select: { id: true, name: true, customTypeId: true },
    orderBy: { name: "asc" },
  });
  const byType: Record<string, { id: string; name: string }[]> = {};
  for (const { id, name, customTypeId } of entities) {
    if (customTypeId) {
      (byType[customTypeId] ??= []).push({ id, name });
    }
  }
  return byType;
}

// Suppression d'un type personnalise, avec reaffectation de ses entrees, en
// UNE transaction. La carte doit couvrir EXACTEMENT les entrees du type au
// moment de l'appel (ni manquante, ni en trop) - sinon refus, l'utilisateur
// recharge. Cible : n'importe quel natif (meme masque) ou un AUTRE type
// personnalise DU MEME monde. Meme garde que le masquage : le dernier type
// proposable du monde ne disparait pas.
export async function deleteCustomType(
  ownerId: string,
  worldId: string,
  typeId: string,
  reassign: ReassignMap,
): Promise<void> {
  const world = await getWorld(ownerId, worldId);
  const allNativesHidden = ENTITY_TYPES.every((native) => world.hiddenEntityTypes.includes(native));
  try {
    await prisma.$transaction(async (tx) => {
      const customType = await tx.customEntityType.findFirst({
        where: { id: typeId, worldId },
        select: { id: true },
      });
      if (!customType) {
        throw new CustomTypeNotFoundError();
      }
      if (allNativesHidden && (await tx.customEntityType.count({ where: { worldId } })) <= 1) {
        throw new LastSelectableTypeError();
      }

      const entries = await tx.entity.findMany({
        where: { worldId, customTypeId: typeId },
        select: { id: true },
      });
      const entryIds = new Set(entries.map(({ id }) => id));
      const mapIds = Object.keys(reassign);
      if (mapIds.length !== entryIds.size || mapIds.some((id) => !entryIds.has(id))) {
        throw new ReassignMapStaleError();
      }

      const idsByTarget = new Map<string, string[]>();
      for (const [entityId, targetKey] of Object.entries(reassign)) {
        idsByTarget.set(targetKey, [...(idsByTarget.get(targetKey) ?? []), entityId]);
      }
      for (const [targetKey, entityIds] of idsByTarget) {
        const target = parseTypeKey(targetKey);
        if (!target || target.customTypeId === typeId) {
          throw new CustomTypeNotFoundError();
        }
        if (target.customTypeId) {
          const targetType = await tx.customEntityType.findFirst({
            where: { id: target.customTypeId, worldId },
            select: { id: true },
          });
          if (!targetType) {
            throw new CustomTypeNotFoundError();
          }
        }
        await tx.entity.updateMany({
          where: { id: { in: entityIds }, worldId },
          data: { type: target.type, customTypeId: target.customTypeId },
        });
      }

      await tx.customEntityType.delete({ where: { id: typeId } });
    });
  } catch (error) {
    // Une entree rattachee au type entre la relecture et la suppression : la
    // FK NO ACTION refuse le DELETE, la transaction est annulee - meme
    // reponse qu'une carte perimee.
    if (isForeignKeyViolation(error)) {
      throw new ReassignMapStaleError({ cause: error });
    }
    throw error;
  }
}
