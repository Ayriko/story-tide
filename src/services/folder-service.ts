import { prisma } from "@/db/client";
import type { CreateFolderInput, RenameFolderInput } from "@/lib/folder-schemas";
import type { Entity, Folder } from "@/generated/prisma/client";
import { getWorld } from "./world-service";

// Organisation FACULTATIVE des entites d'un monde (KAN-38), en arborescence.
// Coexiste avec le regroupement existant par type d'entite sans le
// remplacer : ce fichier n'importe rien d'entity-schemas.ts, et
// entity-service.ts n'importe jamais folder-service.ts - deux regroupements
// independants, ni l'un ni l'autre parent de l'autre.
export class FolderNotFoundError extends Error {
  constructor() {
    super("Dossier introuvable.");
    this.name = "FolderNotFoundError";
  }
}

export class FolderCycleError extends Error {
  constructor() {
    super("Impossible de déplacer un dossier dans lui-même ou l'un de ses sous-dossiers.");
    this.name = "FolderCycleError";
  }
}

export type FolderTreeNode = Folder & { children: FolderTreeNode[]; entities: Entity[] };

// Scope worldId (jamais ownerId seul) - un dossier n'a pas de proprietaire
// direct, il herite de celui du monde deja verifie par l'appelant public via
// getWorld. Meme frontiere anti-fuite-d'existence que getWorld : un dossier
// d'un autre monde rend la meme erreur qu'un dossier inexistant.
async function getFolder(worldId: string, folderId: string): Promise<Folder> {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, worldId } });
  if (!folder) {
    throw new FolderNotFoundError();
  }
  return folder;
}

export async function createFolder(
  ownerId: string,
  worldId: string,
  input: CreateFolderInput,
): Promise<Folder> {
  await getWorld(ownerId, worldId);
  if (input.parentId) {
    await getFolder(worldId, input.parentId); // 404 si parent absent ou d'un autre monde
  }
  return prisma.folder.create({
    data: { worldId, name: input.name, parentId: input.parentId },
  });
}

export async function renameFolder(
  ownerId: string,
  worldId: string,
  folderId: string,
  input: RenameFolderInput,
): Promise<Folder> {
  await getWorld(ownerId, worldId);
  const folder = await getFolder(worldId, folderId);
  return prisma.folder.update({ where: { id: folder.id }, data: { name: input.name } });
}

// Remonte la chaine parentId depuis newParentId ; si folderId (le dossier
// qu'on deplace) est atteint - y compris immediatement, ce qui couvre aussi
// le deplacement dans soi-meme sans code separe - le deplacement creerait un
// cycle, rejete AVANT toute ecriture.
async function assertNoCycle(
  worldId: string,
  folderId: string,
  newParentId: string,
): Promise<void> {
  let cursor: string | null = newParentId;
  while (cursor) {
    if (cursor === folderId) {
      throw new FolderCycleError();
    }
    const parent: { parentId: string | null } | null = await prisma.folder.findFirst({
      where: { id: cursor, worldId },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
}

export async function moveFolder(
  ownerId: string,
  worldId: string,
  folderId: string,
  newParentId: string | null,
): Promise<Folder> {
  await getWorld(ownerId, worldId);
  const folder = await getFolder(worldId, folderId);
  if (newParentId !== null) {
    await getFolder(worldId, newParentId);
    await assertNoCycle(worldId, folder.id, newParentId);
  }
  return prisma.folder.update({ where: { id: folder.id }, data: { parentId: newParentId } });
}

// Suppression structurelle : les sous-dossiers disparaissent en cascade
// (Folder.parent -> onDelete: Cascade, structure pure), mais AUCUNE entite
// n'est jamais supprimee - Entity.folder -> onDelete: SetNull garantit que
// chaque entite du sous-arbre, a toute profondeur, repasse a folderId=null
// avant que sa ligne Folder ne disparaisse. Ces deux actions FK sont
// NATIVES Postgres (relationMode="foreignKeys" par defaut pour ce
// provider, non surcharge dans schema.prisma) : Postgres les applique de
// facon transitive pour chaque ligne Folder supprimee - qu'elle le soit
// directement ou via la cascade d'un parent - dans la MEME instruction
// DELETE. Aucune requete recursive manuelle, aucune transaction explicite
// necessaire cote service. Verifie manuellement contre le Postgres local
// (arbre a 3 niveaux, entites a plusieurs profondeurs, suppression de la
// racine) avant d'ecrire cette fonction - voir dev-log.
export async function deleteFolder(
  ownerId: string,
  worldId: string,
  folderId: string,
): Promise<void> {
  await getWorld(ownerId, worldId);
  const folder = await getFolder(worldId, folderId);
  await prisma.folder.delete({ where: { id: folder.id } });
}

// Arbre complet du monde, construit en JS a partir d'une seule requete a
// plat (meme choix que listWorlds : partition en memoire plutot qu'une
// requete recursive SQL, plus simple a lire et suffisant au volume d'un
// monde). include: entities (KAN-60) : un dossier peut desormais contenir
// des entites (moveEntityToFolder, entity-service.ts) - meme ordre que
// getUnfiledEntities (createdAt desc), une seule convention de tri pour
// "entites d'un dossier" quel que soit le dossier (y compris "non classe").
export async function getFolderTree(ownerId: string, worldId: string): Promise<FolderTreeNode[]> {
  await getWorld(ownerId, worldId);
  const folders = await prisma.folder.findMany({
    where: { worldId },
    orderBy: { createdAt: "asc" },
    include: { entities: { orderBy: { createdAt: "desc" } } },
  });
  const byParent = new Map<string | null, (typeof folders)[number][]>();
  for (const folder of folders) {
    byParent.set(folder.parentId, [...(byParent.get(folder.parentId) ?? []), folder]);
  }
  function build(parentId: string | null): FolderTreeNode[] {
    return (byParent.get(parentId) ?? []).map((folder) => ({
      ...folder,
      children: build(folder.id),
    }));
  }
  return build(null);
}

// Entites sans dossier ("non classe") - coexiste avec le regroupement par
// type existant (entity-schemas.ts) sans jamais le remplacer : aucun import
// vers entity-schemas.ts ici, et entity-service.ts n'importe jamais ce
// fichier.
export async function getUnfiledEntities(ownerId: string, worldId: string): Promise<Entity[]> {
  await getWorld(ownerId, worldId);
  return prisma.entity.findMany({
    where: { worldId, folderId: null },
    orderBy: { createdAt: "desc" },
  });
}
