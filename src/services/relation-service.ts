import { prisma } from "@/db/client";
import type { RelationOrigin } from "@/generated/prisma/client";
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

export interface OutgoingLink {
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
): Promise<OutgoingLink[]> {
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
