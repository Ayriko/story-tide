import { cache } from "react";
import { prisma } from "@/db/client";
import { Prisma } from "@/generated/prisma/client";
import {
  RELATION_TYPES,
  RELATION_TYPE_REFERENCE,
  customRelationTypeKey,
  isNativeRelationType,
  parseRelationTypeKey,
  type WorldRelationTypeCatalog,
} from "@/lib/relation-types";
import type { CustomRelationTypeInput, RelationReassignMap } from "@/lib/relation-type-schemas";
import { normalizeForMatch } from "@/lib/linker/normalize";
import { WorldNotFoundError, getWorld } from "./world-service";

// Type de relation personnalise inexistant OU d'un autre monde : meme erreur
// (OWASP A01).
export class CustomRelationTypeNotFoundError extends Error {
  constructor() {
    super("Type de relation introuvable.");
    this.name = "CustomRelationTypeNotFoundError";
  }
}

// `field` : champ du formulaire a signaler (le libelle ou son inverse).
export class RelationTypeLabelTakenError extends Error {
  readonly field: "label" | "inverseLabel";

  constructor(
    field: "label" | "inverseLabel",
    message = "Ce libellé est déjà utilisé dans ce monde.",
    options?: { cause: unknown },
  ) {
    super(message, options);
    this.name = "RelationTypeLabelTakenError";
    this.field = field;
  }
}

export class LastSelectableRelationTypeError extends Error {
  constructor() {
    super("Au moins un type de relation doit rester proposé dans ce monde.");
    this.name = "LastSelectableRelationTypeError";
  }
}

// Changer la nature (symetrique <-> dirige) d'un type deja utilise
// retournerait ou fusionnerait silencieusement des relations existantes.
export class RelationTypeInUseError extends Error {
  constructor() {
    super(
      "Ce type est déjà utilisé : son sens ne peut plus changer. Crée un nouveau type puis réaffecte les relations.",
    );
    this.name = "RelationTypeInUseError";
  }
}

export class RelationReassignStaleError extends Error {
  constructor(options?: { cause: unknown }) {
    super("La liste a changé, recharge la page.", options);
    this.name = "RelationReassignStaleError";
  }
}

// Reaffectation vers un type de nature differente : un dirige ne devient pas
// symetrique (et inversement) sans que l'auteur choisisse le sens.
export class RelationReassignKindError extends Error {
  constructor() {
    super("Le type cible doit être de même nature (symétrique ou dirigée).");
    this.name = "RelationReassignKindError";
  }
}

// Catalogue des types de relation d'un monde (KAN-84, patron
// getWorldTypeCatalog) : une requete qui verifie aussi l'appartenance,
// cache() de React - une seule requete par rendu serveur.
export const getWorldRelationTypeCatalog = cache(
  async (ownerId: string, worldId: string): Promise<WorldRelationTypeCatalog> => {
    const world = await prisma.world.findFirst({
      where: { id: worldId, ownerId },
      select: {
        hiddenRelationTypes: true,
        customRelationTypes: {
          select: { id: true, label: true, inverseLabel: true, symmetric: true },
          orderBy: { label: "asc" },
        },
      },
    });
    if (!world) {
      throw new WorldNotFoundError();
    }
    return { custom: world.customRelationTypes, hidden: world.hiddenRelationTypes };
  },
);

// Libelles ET inverses natifs : « Parent de » comme « Enfant de » sont
// refuses comme libelle (ou inverse) personnalise, casse et accents ignores.
const NATIVE_RELATION_LABEL_KEYS = new Set(
  RELATION_TYPES.flatMap((type) => {
    const { label, inverseLabel } = RELATION_TYPE_REFERENCE[type];
    return [label, ...(inverseLabel ? [inverseLabel] : [])].map(normalizeForMatch);
  }),
);

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

function labelFields(input: CustomRelationTypeInput) {
  const label = input.label.normalize("NFC");
  const inverseLabel = input.symmetric ? null : (input.inverseLabel?.normalize("NFC") ?? null);
  return { label, labelKey: normalizeForMatch(label), inverseLabel, symmetric: input.symmetric };
}

// Unicite du libelle et de l'inverse dans le monde : contre les natifs (et
// leurs inverses), contre les libelles ET inverses des autres types perso,
// et l'un contre l'autre. L'index unique (worldId, labelKey) reste le filet
// d'une course entre deux onglets (P2002).
async function assertLabelsFree(
  worldId: string,
  fields: ReturnType<typeof labelFields>,
  exceptId?: string,
) {
  const inverseKey = fields.inverseLabel ? normalizeForMatch(fields.inverseLabel) : null;
  if (inverseKey !== null && inverseKey === fields.labelKey) {
    throw new RelationTypeLabelTakenError(
      "inverseLabel",
      "Le libellé inverse doit différer du libellé.",
    );
  }
  if (NATIVE_RELATION_LABEL_KEYS.has(fields.labelKey)) {
    throw new RelationTypeLabelTakenError("label");
  }
  if (inverseKey !== null && NATIVE_RELATION_LABEL_KEYS.has(inverseKey)) {
    throw new RelationTypeLabelTakenError("inverseLabel");
  }
  const others = await prisma.customRelationType.findMany({
    where: { worldId, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { labelKey: true, inverseLabel: true },
  });
  const taken = new Set(
    others.flatMap(({ labelKey, inverseLabel }) => [
      labelKey,
      ...(inverseLabel ? [normalizeForMatch(inverseLabel)] : []),
    ]),
  );
  if (taken.has(fields.labelKey)) {
    throw new RelationTypeLabelTakenError("label");
  }
  if (inverseKey !== null && taken.has(inverseKey)) {
    throw new RelationTypeLabelTakenError("inverseLabel");
  }
}

export async function createCustomRelationType(
  ownerId: string,
  worldId: string,
  input: CustomRelationTypeInput,
) {
  await getWorld(ownerId, worldId);
  const fields = labelFields(input);
  await assertLabelsFree(worldId, fields);
  try {
    return await prisma.customRelationType.create({ data: { worldId, ...fields } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RelationTypeLabelTakenError("label", undefined, { cause: error });
    }
    throw error;
  }
}

export async function updateCustomRelationType(
  ownerId: string,
  worldId: string,
  typeId: string,
  input: CustomRelationTypeInput,
) {
  await getWorld(ownerId, worldId);
  const current = await prisma.customRelationType.findFirst({
    where: { id: typeId, worldId },
    select: { id: true, symmetric: true },
  });
  if (!current) {
    throw new CustomRelationTypeNotFoundError();
  }
  const fields = labelFields(input);
  if (fields.symmetric !== current.symmetric) {
    const used = await prisma.declaredRelation.count({
      where: { worldId, customRelationTypeId: typeId },
    });
    if (used > 0) {
      throw new RelationTypeInUseError();
    }
  }
  await assertLabelsFree(worldId, fields, typeId);
  try {
    return await prisma.customRelationType.update({ where: { id: typeId }, data: fields });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RelationTypeLabelTakenError("label", undefined, { cause: error });
    }
    throw error;
  }
}

// Masquer un type natif : ses relations restent et s'affichent, il n'est plus
// propose depuis les fiches. Au moins un type proposable doit rester.
export async function setNativeRelationTypeHidden(
  ownerId: string,
  worldId: string,
  type: string,
  hidden: boolean,
): Promise<void> {
  const world = await getWorld(ownerId, worldId);
  const next = hidden
    ? Array.from(new Set([...world.hiddenRelationTypes, type]))
    : world.hiddenRelationTypes.filter((hiddenType) => hiddenType !== type);
  if (hidden && RELATION_TYPES.every((native) => next.includes(native))) {
    const customCount = await prisma.customRelationType.count({ where: { worldId } });
    if (customCount === 0) {
      throw new LastSelectableRelationTypeError();
    }
  }
  await prisma.world.update({ where: { id: world.id }, data: { hiddenRelationTypes: next } });
}

// Nombre de relations declarees par cle de type (native ou `custom:<id>`).
export async function getRelationTypeUsage(
  ownerId: string,
  worldId: string,
): Promise<Record<string, number>> {
  await getWorld(ownerId, worldId);
  const rows = await prisma.declaredRelation.groupBy({
    by: ["typeKey"],
    where: { worldId },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.typeKey, row._count._all]));
}

export type CustomRelationTypeUsage = {
  id: string;
  sourceName: string;
  targetName: string;
  // Autres types deja portes par la meme paire ordonnee : la fenetre annonce
  // qu'une reaffectation vers l'un d'eux supprimera la relation (doublon).
  existingTypeKeys: string[];
};

// Relations de chaque type personnalise du monde (fenetre de reaffectation).
export async function listCustomRelationTypeUsages(
  ownerId: string,
  worldId: string,
): Promise<Record<string, CustomRelationTypeUsage[]>> {
  await getWorld(ownerId, worldId);
  const relations = await prisma.declaredRelation.findMany({
    where: { worldId, customRelationTypeId: { not: null } },
    select: {
      id: true,
      sourceId: true,
      targetId: true,
      customRelationTypeId: true,
      source: { select: { name: true } },
      target: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (relations.length === 0) {
    return {};
  }
  const samePairs = await prisma.declaredRelation.findMany({
    where: { worldId, sourceId: { in: relations.map(({ sourceId }) => sourceId) } },
    select: { sourceId: true, targetId: true, typeKey: true },
  });
  const byType: Record<string, CustomRelationTypeUsage[]> = {};
  for (const relation of relations) {
    if (!relation.customRelationTypeId) {
      continue;
    }
    const ownKey = customRelationTypeKey(relation.customRelationTypeId);
    (byType[relation.customRelationTypeId] ??= []).push({
      id: relation.id,
      sourceName: relation.source.name,
      targetName: relation.target.name,
      existingTypeKeys: samePairs
        .filter(
          (other) =>
            other.sourceId === relation.sourceId &&
            other.targetId === relation.targetId &&
            other.typeKey !== ownKey,
        )
        .map(({ typeKey }) => typeKey),
    });
  }
  return byType;
}

// Suppression d'un type de relation personnalise, avec reaffectation de ses
// relations, en UNE transaction. La carte couvre EXACTEMENT les relations du
// type (sinon refus, l'auteur recharge). Cible : un natif (meme masque) ou un
// AUTRE type perso du monde, de MEME nature. Si la paire porte deja le type
// cible, la relation reaffectee est supprimee (doublon) au lieu de violer
// l'index unique - la fenetre l'annonce avant validation.
export async function deleteCustomRelationType(
  ownerId: string,
  worldId: string,
  typeId: string,
  reassign: RelationReassignMap,
): Promise<void> {
  const world = await getWorld(ownerId, worldId);
  const allNativesHidden = RELATION_TYPES.every((native) =>
    world.hiddenRelationTypes.includes(native),
  );
  try {
    await prisma.$transaction(async (tx) => {
      const customType = await tx.customRelationType.findFirst({
        where: { id: typeId, worldId },
        select: { id: true, symmetric: true },
      });
      if (!customType) {
        throw new CustomRelationTypeNotFoundError();
      }
      if (allNativesHidden && (await tx.customRelationType.count({ where: { worldId } })) <= 1) {
        throw new LastSelectableRelationTypeError();
      }

      const relations = await tx.declaredRelation.findMany({
        where: { worldId, customRelationTypeId: typeId },
        select: { id: true, sourceId: true, targetId: true },
      });
      const relationIds = new Set(relations.map(({ id }) => id));
      const mapIds = Object.keys(reassign);
      if (mapIds.length !== relationIds.size || mapIds.some((id) => !relationIds.has(id))) {
        throw new RelationReassignStaleError();
      }

      const idsByTarget = new Map<string, string[]>();
      for (const [relationId, targetKey] of Object.entries(reassign)) {
        idsByTarget.set(targetKey, [...(idsByTarget.get(targetKey) ?? []), relationId]);
      }
      for (const [targetKey, ids] of idsByTarget) {
        const target = parseRelationTypeKey(targetKey);
        if (!target || target.customRelationTypeId === typeId) {
          throw new CustomRelationTypeNotFoundError();
        }
        let targetSymmetric: boolean;
        if (target.customRelationTypeId) {
          const targetType = await tx.customRelationType.findFirst({
            where: { id: target.customRelationTypeId, worldId },
            select: { symmetric: true },
          });
          if (!targetType) {
            throw new CustomRelationTypeNotFoundError();
          }
          targetSymmetric = targetType.symmetric;
        } else if (isNativeRelationType(target.relationType)) {
          targetSymmetric = RELATION_TYPE_REFERENCE[target.relationType].inverseLabel === null;
        } else {
          throw new CustomRelationTypeNotFoundError();
        }
        if (targetSymmetric !== customType.symmetric) {
          throw new RelationReassignKindError();
        }

        const moved = relations.filter(({ id }) => ids.includes(id));
        const duplicates = await tx.declaredRelation.findMany({
          where: {
            worldId,
            typeKey: targetKey,
            OR: moved.map(({ sourceId, targetId }) => ({ sourceId, targetId })),
          },
          select: { sourceId: true, targetId: true },
        });
        const isDuplicate = ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
          duplicates.some((other) => other.sourceId === sourceId && other.targetId === targetId);
        const toDelete = moved.filter(isDuplicate).map(({ id }) => id);
        const toUpdate = moved.filter((relation) => !isDuplicate(relation)).map(({ id }) => id);
        if (toDelete.length > 0) {
          await tx.declaredRelation.deleteMany({ where: { id: { in: toDelete }, worldId } });
        }
        if (toUpdate.length > 0) {
          await tx.declaredRelation.updateMany({
            where: { id: { in: toUpdate }, worldId },
            data: {
              relationType: target.relationType,
              customRelationTypeId: target.customRelationTypeId,
              typeKey: targetKey,
            },
          });
        }
      }

      await tx.customRelationType.delete({ where: { id: typeId } });
    });
  } catch (error) {
    // Une relation rattachee (FK NO ACTION) ou un doublon cree entre la
    // relecture et l'ecriture : transaction annulee, meme reponse qu'une carte
    // perimee.
    if (isForeignKeyViolation(error) || isUniqueViolation(error)) {
      throw new RelationReassignStaleError({ cause: error });
    }
    throw error;
  }
}
