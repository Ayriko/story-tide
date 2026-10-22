import { prisma } from "@/db/client";
import { Prisma } from "@/generated/prisma/client";
import { resolveEntityType } from "@/lib/entity-types";
import { suggestRelationChoice } from "@/lib/relation-suggestions";
import {
  allRelationTypes,
  labelFrom,
  parseRelationTypeKey,
  relationChoiceValue,
  resolveRelationType,
  type RelationChoice,
  type RelationViewpoint,
  type ResolvedRelationType,
} from "@/lib/relation-types";
import { EntityNotFoundError, getEntity } from "./entity-service";
import { getWorldTypeCatalog } from "./entity-type-service";
import {
  CustomRelationTypeNotFoundError,
  getWorldRelationTypeCatalog,
} from "./relation-type-service";
import { getWorld } from "./world-service";

// Relations DECLAREES par l'auteur (KAN-84, ADR-0031). Distinctes des reflets
// du texte (Relation AUTO/MANUAL, relation-service.ts) : ce module n'est
// importe ni par relation-service.ts (reconcileManualMentions) ni par
// linker-service.ts (worker) - une sauvegarde de texte ne les touche jamais.
// Chaque fonction : ownerId en premier, appartenance verifiee (OWASP A01).

export class DeclaredRelationNotFoundError extends Error {
  constructor() {
    super("Relation introuvable.");
    this.name = "DeclaredRelationNotFoundError";
  }
}

export class DeclaredRelationDuplicateError extends Error {
  constructor(options?: { cause: unknown }) {
    super("Cette relation existe déjà.", options);
    this.name = "DeclaredRelationDuplicateError";
  }
}

export class SelfRelationError extends Error {
  constructor() {
    super("Une entrée ne peut pas être en relation avec elle-même.");
    this.name = "SelfRelationError";
  }
}

export class RelationTypeHiddenError extends Error {
  constructor() {
    super("Ce type de relation n'est plus proposé dans ce monde.");
    this.name = "RelationTypeHiddenError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Entree du MEME monde, sinon « introuvable » (un id d'un autre monde ne se
// distingue pas d'un id inexistant).
async function assertEntityInWorld(worldId: string, entityId: string) {
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, worldId },
    select: { id: true },
  });
  if (!entity) {
    throw new EntityNotFoundError();
  }
}

// Ids des deux fiches touchees (revalidation de la source ET de la cible).
export type DeclaredRelationEnds = { sourceId: string; targetId: string };

// Declare une relation DEPUIS la fiche `entityId` vers `otherId` : le point de
// vue du choix fixe le sens (« Enfant de » choisi sur Aldric = Selyne -parent->
// Aldric). Symetrique : paire ordonnee par id, pour que A<->B et B<->A tombent
// sur le meme index unique (doublon refuse).
export async function createDeclaredRelation(
  ownerId: string,
  worldId: string,
  entityId: string,
  otherId: string,
  choice: RelationChoice,
): Promise<DeclaredRelationEnds> {
  await getEntity(ownerId, worldId, entityId);
  await assertEntityInWorld(worldId, otherId);
  if (entityId === otherId) {
    throw new SelfRelationError();
  }

  const catalog = await getWorldRelationTypeCatalog(ownerId, worldId);
  const type = allRelationTypes(catalog).find((candidate) => candidate.key === choice.key);
  const stored = parseRelationTypeKey(choice.key);
  if (!type || !stored) {
    throw new CustomRelationTypeNotFoundError();
  }
  if (type.isHidden) {
    throw new RelationTypeHiddenError();
  }

  const fromEntity = choice.viewpoint === "source";
  const ordered = type.symmetric ? entityId < otherId : fromEntity;
  const sourceId = ordered ? entityId : otherId;
  const targetId = ordered ? otherId : entityId;

  try {
    await prisma.declaredRelation.create({
      data: {
        worldId,
        sourceId,
        targetId,
        relationType: stored.relationType,
        customRelationTypeId: stored.customRelationTypeId,
        typeKey: type.key,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DeclaredRelationDuplicateError({ cause: error });
    }
    throw error;
  }
  return { sourceId, targetId };
}

export async function deleteDeclaredRelation(
  ownerId: string,
  worldId: string,
  relationId: string,
): Promise<DeclaredRelationEnds> {
  await getWorld(ownerId, worldId);
  const relation = await prisma.declaredRelation.findFirst({
    where: { id: relationId, worldId },
    select: { sourceId: true, targetId: true },
  });
  if (!relation) {
    throw new DeclaredRelationNotFoundError();
  }
  const { count } = await prisma.declaredRelation.deleteMany({
    where: { id: relationId, worldId },
  });
  if (count === 0) {
    throw new DeclaredRelationNotFoundError();
  }
  return relation;
}

// Vue d'affichage d'une relation depuis UNE fiche : type resolu et libelle lu
// depuis cette fiche - aucun champ de type brut (blindage des affichages).
export type DeclaredRelationView = {
  id: string;
  other: { id: string; name: string };
  relationType: ResolvedRelationType;
  viewpoint: RelationViewpoint;
  label: string;
};

export async function listDeclaredRelationsForEntity(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<DeclaredRelationView[]> {
  await getEntity(ownerId, worldId, entityId);
  const [relations, catalog] = await Promise.all([
    prisma.declaredRelation.findMany({
      where: { worldId, OR: [{ sourceId: entityId }, { targetId: entityId }] },
      select: {
        id: true,
        sourceId: true,
        relationType: true,
        customRelationTypeId: true,
        source: { select: { id: true, name: true } },
        target: { select: { id: true, name: true } },
      },
    }),
    getWorldRelationTypeCatalog(ownerId, worldId),
  ]);
  return relations
    .map((relation): DeclaredRelationView => {
      const relationType = resolveRelationType(relation, catalog);
      const viewpoint: RelationViewpoint = relation.sourceId === entityId ? "source" : "target";
      return {
        id: relation.id,
        other: viewpoint === "source" ? relation.target : relation.source,
        relationType,
        viewpoint,
        label: labelFrom(relationType, viewpoint),
      };
    })
    .sort(
      (a, b) =>
        a.label.localeCompare(b.label, "fr") || a.other.name.localeCompare(b.other.name, "fr"),
    );
}

// Relations declarees du monde pour la Constellation, type deja resolu.
// orderBy stable : meme raison que listWorldRelations (layout cose).
export type WorldDeclaredRelation = {
  sourceId: string;
  targetId: string;
  relationType: ResolvedRelationType;
};

export async function listWorldDeclaredRelations(
  ownerId: string,
  worldId: string,
): Promise<WorldDeclaredRelation[]> {
  await getWorld(ownerId, worldId);
  const [relations, catalog] = await Promise.all([
    prisma.declaredRelation.findMany({
      where: { worldId },
      select: { sourceId: true, targetId: true, relationType: true, customRelationTypeId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    getWorldRelationTypeCatalog(ownerId, worldId),
  ]);
  return relations.map((relation) => ({
    sourceId: relation.sourceId,
    targetId: relation.targetId,
    relationType: resolveRelationType(relation, catalog),
  }));
}

// Suggestion : une entree CITEE par la fiche (lien sortant AUTO ou MANUAL)
// sans aucune relation declaree avec elle, dans un sens ou l'autre, et non
// ecartee. `preselected` : valeur d'option du select, ou null.
export type RelationSuggestion = { id: string; name: string; preselected: string | null };

export async function listRelationSuggestions(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<RelationSuggestion[]> {
  const entity = await getEntity(ownerId, worldId, entityId);
  const [links, declared, ignored, entityCatalog, relationCatalog] = await Promise.all([
    prisma.relation.findMany({ where: { sourceId: entityId }, select: { targetId: true } }),
    prisma.declaredRelation.findMany({
      where: { worldId, OR: [{ sourceId: entityId }, { targetId: entityId }] },
      select: { sourceId: true, targetId: true },
    }),
    prisma.relationSuggestionIgnore.findMany({ where: { entityId }, select: { targetId: true } }),
    getWorldTypeCatalog(ownerId, worldId),
    getWorldRelationTypeCatalog(ownerId, worldId),
  ]);

  const excluded = new Set([
    entityId,
    ...declared.map((relation) =>
      relation.sourceId === entityId ? relation.targetId : relation.sourceId,
    ),
    ...ignored.map(({ targetId }) => targetId),
  ]);
  const candidateIds = [...new Set(links.map(({ targetId }) => targetId))].filter(
    (id) => !excluded.has(id),
  );
  if (candidateIds.length === 0) {
    return [];
  }

  const targets = await prisma.entity.findMany({
    where: { id: { in: candidateIds }, worldId },
    select: { id: true, name: true, type: true, customTypeId: true },
  });
  const sourceType = resolveEntityType(entity, entityCatalog);
  return targets
    .map((target) => {
      const choice = suggestRelationChoice(
        sourceType,
        resolveEntityType(target, entityCatalog),
        relationCatalog,
      );
      return {
        id: target.id,
        name: target.name,
        preselected: choice ? relationChoiceValue(choice) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function ignoreRelationSuggestion(
  ownerId: string,
  worldId: string,
  entityId: string,
  targetId: string,
): Promise<void> {
  await getEntity(ownerId, worldId, entityId);
  await assertEntityInWorld(worldId, targetId);
  await prisma.relationSuggestionIgnore.upsert({
    where: { entityId_targetId: { entityId, targetId } },
    create: { worldId, entityId, targetId },
    update: {},
  });
}

export async function unignoreRelationSuggestion(
  ownerId: string,
  worldId: string,
  entityId: string,
  targetId: string,
): Promise<void> {
  await getEntity(ownerId, worldId, entityId);
  await prisma.relationSuggestionIgnore.deleteMany({ where: { entityId, targetId } });
}

export async function listIgnoredRelationSuggestions(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<{ id: string; name: string }[]> {
  await getEntity(ownerId, worldId, entityId);
  const ignored = await prisma.relationSuggestionIgnore.findMany({
    where: { entityId },
    select: { target: { select: { id: true, name: true } } },
  });
  return ignored.map(({ target }) => target).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
