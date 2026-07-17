import { prisma } from "@/db/client";
import { RelationOrigin } from "@/generated/prisma/client";
import { getWorld } from "./world-service";

// Autorisation en cascade (meme pattern que entity-service.ts) : appartenance
// au monde verifiee via getWorld avant tout acces aux LinkIgnore/Relation.
export async function getIgnoredTargetIds(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<string[]> {
  await getWorld(ownerId, worldId);
  const rows = await prisma.linkIgnore.findMany({
    where: { entityId },
    select: { targetId: true },
  });
  return rows.map((row) => row.targetId);
}

// Nom neutre : sert aux deux sens (sortant via listOutgoingLinks, entrant via
// listIncomingLinks) - la forme est identique, seul le sens de la relation
// resolue change.
export interface LinkedEntity {
  id: string;
  name: string;
  origin: RelationOrigin;
}

// Liste les entites liees (AUTO et MANUAL, jamais filtre sur origin ici -
// contrairement a scanAndLinkEntity qui ne lit/ecrit QUE l'origin=AUTO) pour
// la liste "Entites liees" affichee sous l'editeur (navigation clavier/lecteur
// d'ecran, RGAA - le surlignage live dans l'editeur n'est pas atteignable au
// clavier). Deux requetes a select plat (jamais de select imbrique sur une
// relation Prisma) plutot qu'un join : chacune reste mockable en test avec un
// objet complet du modele (cf. skill prisma-mock-partial-select), sans dependre
// de la precision du type genere pour un select imbrique specifique.
export async function listOutgoingLinks(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<LinkedEntity[]> {
  await getWorld(ownerId, worldId);

  const relations = await prisma.relation.findMany({
    where: { sourceId: entityId },
    select: { targetId: true, origin: true },
  });
  if (relations.length === 0) {
    return [];
  }

  const targets = await prisma.entity.findMany({
    where: { id: { in: relations.map((relation) => relation.targetId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(targets.map((target) => [target.id, target.name]));

  return relations
    .flatMap((relation) => {
      const name = nameById.get(relation.targetId);
      // Cible supprimee entre la lecture de Relation et celle-ci (rare, cf.
      // onDelete: Cascade normalement synchrone) : on ne devine jamais un nom,
      // on omet silencieusement l'entree plutot que d'afficher un lien mort.
      return name === undefined ? [] : [{ id: relation.targetId, name, origin: relation.origin }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Symetrique de listOutgoingLinks : quelles fiches MENTIONNENT celle-ci
// ("Mentionne par", backlinks KAN-24). On filtre sur targetId et on resout
// le sourceId de chaque relation (pas targetId) - meme raisonnement anti-piege
// select plat / deux requetes (prisma-mock-partial-select).
export async function listIncomingLinks(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<LinkedEntity[]> {
  await getWorld(ownerId, worldId);

  const relations = await prisma.relation.findMany({
    where: { targetId: entityId },
    select: { sourceId: true, origin: true },
  });
  if (relations.length === 0) {
    return [];
  }

  const sources = await prisma.entity.findMany({
    where: { id: { in: relations.map((relation) => relation.sourceId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(sources.map((source) => [source.id, source.name]));

  return relations
    .flatMap((relation) => {
      const name = nameById.get(relation.sourceId);
      // Source supprimee entre la lecture de Relation et celle-ci (rare, cf.
      // onDelete: Cascade normalement synchrone) : on ne devine jamais un nom,
      // on omet silencieusement l'entree plutot que d'afficher un lien mort.
      return name === undefined ? [] : [{ id: relation.sourceId, name, origin: relation.origin }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface WorldRelation {
  sourceId: string;
  targetId: string;
  origin: RelationOrigin;
}

// Pour le graphe (KAN-25) : TOUTES les relations d'un monde, pas filtrees par
// entite - contrairement a listOutgoingLinks/listIncomingLinks (une seule
// entite). Select plat, jamais de nom resolu ici : le graphe recoit deja la
// liste complete des entites du monde (listEntities) et fait sa propre
// jointure en memoire (src/lib/graph-elements.ts), pas la peine de dupliquer
// une resolution de noms deja disponible.
export async function listWorldRelations(
  ownerId: string,
  worldId: string,
): Promise<WorldRelation[]> {
  await getWorld(ownerId, worldId);
  return prisma.relation.findMany({
    where: { worldId },
    select: { sourceId: true, targetId: true, origin: true },
  });
}

// Reconcilie les Relation origin=MANUAL a partir des mentions @ trouvees dans
// le contenu au moment de la sauvegarde (KAN-22) - meme patron diff
// ajout/suppression que scanAndLinkEntity (linker-service.ts), mais jamais la
// meme origin : la contrainte @@unique([sourceId, targetId, origin]) fait
// coexister une ligne AUTO et une ligne MANUAL pour le meme couple
// source/cible sans jamais se percuter - aucun risque d'ecraser un AUTO ici,
// par construction (filtre origin: MANUAL sur les trois requetes).
//
// mentionedEntityIds vient du CLIENT (contenu de l'editeur) : jamais de
// confiance aveugle. Revalide leur appartenance au monde courant via une
// requete reelle avant toute ecriture (OWASP A01 - un id d'un autre monde ne
// doit jamais pouvoir creer une Relation). L'auto-mention (mentionner sa
// propre fiche) est filtree defensivement, meme si l'UI l'exclut deja.
export async function reconcileManualMentions(
  ownerId: string,
  worldId: string,
  entityId: string,
  mentionedEntityIds: string[],
): Promise<void> {
  await getWorld(ownerId, worldId);

  const candidateIds = [...new Set(mentionedEntityIds)].filter((id) => id !== entityId);
  const validTargets =
    candidateIds.length === 0
      ? []
      : await prisma.entity.findMany({
          where: { id: { in: candidateIds }, worldId },
          select: { id: true },
        });
  const desiredTargets = new Set(validTargets.map((target) => target.id));

  const existingManual = await prisma.relation.findMany({
    where: { sourceId: entityId, origin: RelationOrigin.MANUAL },
    select: { targetId: true },
  });
  const existingTargets = new Set(existingManual.map((row) => row.targetId));

  const toAdd = [...desiredTargets].filter((targetId) => !existingTargets.has(targetId));
  const toRemove = [...existingTargets].filter((targetId) => !desiredTargets.has(targetId));

  if (toAdd.length === 0 && toRemove.length === 0) {
    return;
  }

  // Transaction : le diff s'applique en un bloc, jamais partiellement.
  await prisma.$transaction([
    ...(toAdd.length > 0
      ? [
          prisma.relation.createMany({
            data: toAdd.map((targetId) => ({
              worldId,
              sourceId: entityId,
              targetId,
              origin: RelationOrigin.MANUAL,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
    ...(toRemove.length > 0
      ? [
          prisma.relation.deleteMany({
            where: {
              sourceId: entityId,
              origin: RelationOrigin.MANUAL,
              targetId: { in: toRemove },
            },
          }),
        ]
      : []),
  ]);
}
