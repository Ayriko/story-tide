import { prisma } from "@/db/client";
import { RelationOrigin } from "@/generated/prisma/client";
import { getEntity } from "./entity-service";
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

export interface IgnoredTarget {
  id: string;
  name: string;
}

// Cibles actuellement ignorees pour cette entite, noms resolus (UI "Liens
// ignores" + bouton "Ne plus ignorer") - meme patron deux-requetes-a-select-
// plat que listOutgoingLinks. getIgnoredTargetIds (ids seuls) reste inchange,
// deja utilise par scanAndLinkEntity et le surlignage live.
export async function listIgnoredTargets(
  ownerId: string,
  worldId: string,
  entityId: string,
): Promise<IgnoredTarget[]> {
  // getEntity (pas getWorld seul) : verifie aussi que entityId appartient a
  // CE monde, pas seulement que le monde appartient au proprietaire - sans
  // cette verification, un entityId d'un monde etranger passerait la garde
  // getWorld et laisserait lire/ecrire du LinkIgnore hors du monde autorise
  // (OWASP A01). Les fonctions voisines (listOutgoingLinks, etc.) n'ont pas
  // cette verification supplementaire - risque preexistant hors perimetre de
  // ce ticket, signale a Aymeric plutot que corrige ici.
  await getEntity(ownerId, worldId, entityId);

  const ignored = await prisma.linkIgnore.findMany({
    where: { entityId },
    select: { targetId: true },
  });
  if (ignored.length === 0) {
    return [];
  }

  const targets = await prisma.entity.findMany({
    where: { id: { in: ignored.map((row) => row.targetId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(targets.map((target) => [target.id, target.name]));

  return ignored
    .flatMap((row) => {
      const name = nameById.get(row.targetId);
      // Cible supprimee entre les deux requetes (rare) : on omet
      // silencieusement, meme convention que listOutgoingLinks/listIncomingLinks.
      return name === undefined ? [] : [{ id: row.targetId, name }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// "Ignorer un lien" / "delier une relation AUTO" (KAN-23, garde-fou
// anti-faux-positifs, spec §2.5) : la meme mecanique vue de la donnee -
// LinkIgnore n'ignore pas une occurrence precise dans le texte mais une PAIRE
// source->cible (@@unique([entityId, targetId])), donc les deux formulations
// du ticket se resument a la meme ecriture. Supprime aussi la Relation AUTO
// existante tout de suite (pas d'attente du prochain scan) - jamais MANUAL,
// le ticket cible explicitement l'AUTO.
export async function ignoreLink(
  ownerId: string,
  worldId: string,
  entityId: string,
  targetId: string,
): Promise<void> {
  await getEntity(ownerId, worldId, entityId);

  // targetId vient d'un formulaire client - jamais de confiance aveugle,
  // meme garde-fou OWASP A01 que reconcileManualMentions : un id d'un autre
  // monde ne doit jamais pouvoir creer un LinkIgnore.
  const target = await prisma.entity.findFirst({
    where: { id: targetId, worldId },
    select: { id: true },
  });
  if (!target) {
    return;
  }

  await prisma.$transaction([
    prisma.linkIgnore.upsert({
      where: { entityId_targetId: { entityId, targetId } },
      create: { worldId, entityId, targetId },
      update: {},
    }),
    prisma.relation.deleteMany({
      where: { sourceId: entityId, targetId, origin: RelationOrigin.AUTO },
    }),
  ]);
}

// Symetrique : retire la cible de la liste des liens ignores (elle redevient
// detectable par le prochain scan AUTO). No-op silencieux si elle n'etait pas
// ignoree.
export async function unignoreLink(
  ownerId: string,
  worldId: string,
  entityId: string,
  targetId: string,
): Promise<void> {
  await getEntity(ownerId, worldId, entityId);
  await prisma.linkIgnore.deleteMany({ where: { entityId, targetId } });
}
