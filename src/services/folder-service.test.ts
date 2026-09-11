import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import type { Entity, Folder, World } from "@/generated/prisma/client";
import { WorldOrigin } from "@/generated/prisma/client";
import { WorldNotFoundError } from "./world-service";
import {
  FolderCycleError,
  FolderNotFoundError,
  createFolder,
  deleteFolder,
  getFolderTree,
  getUnfiledEntities,
  moveFolder,
  renameFolder,
} from "./folder-service";

// Port Prisma mocke (regle du projet, cf. world-service.test.ts) - getWorld()
// n'est pas mocke a part : il tourne pour de vrai contre prisma.world.findFirst
// mocke ci-dessous, meme convention que entity-service.test.ts.
vi.mock("@/db/client", () => ({
  prisma: {
    world: { findFirst: vi.fn() },
    folder: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    entity: { findMany: vi.fn() },
  },
}));

const worldFindFirst = vi.mocked(prisma.world.findFirst);
const folderFindFirst = vi.mocked(prisma.folder.findFirst);
const folderFindMany = vi.mocked(prisma.folder.findMany);
const folderCreate = vi.mocked(prisma.folder.create);
const folderUpdate = vi.mocked(prisma.folder.update);
const folderDelete = vi.mocked(prisma.folder.delete);
const entityFindMany = vi.mocked(prisma.entity.findMany);

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";

function makeWorld(overrides: Partial<World> = {}): World {
  return {
    id: WORLD_ID,
    ownerId: OWNER_ID,
    name: "Eldoria",
    slug: "eldoria",
    origin: WorldOrigin.USER,
    pinnedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Objet complet malgre le `select: { parentId: true }` reel d'assertNoCycle
// (skill prisma-mock-partial-select) - le mock reste type sur le modele complet.
function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "f1",
    worldId: WORLD_ID,
    name: "Personnages",
    parentId: null,
    seedRef: null,
    createdAt: new Date("2026-09-11T00:00:00.000Z"),
    updatedAt: new Date("2026-09-11T00:00:00.000Z"),
    ...overrides,
  };
}

// getFolderTree (KAN-60) selectionne desormais folder.entities via include -
// le mock folderFindMany doit porter ce champ pour representer fidelement ce
// que Prisma renvoie reellement (jamais `undefined`, meme au repos).
function makeFolderWithEntities(
  overrides: Partial<Folder> = {},
  entities: Entity[] = [],
): Folder & { entities: Entity[] } {
  return { ...makeFolder(overrides), entities };
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "e1",
    worldId: WORLD_ID,
    name: "Aldéric",
    type: "character",
    content: {},
    plainText: "",
    seedRef: null,
    folderId: null,
    createdAt: new Date("2026-09-11T00:00:00.000Z"),
    updatedAt: new Date("2026-09-11T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("autorisation par appartenance au monde", () => {
  it("createFolder : leve WorldNotFoundError pour un non-membre, sans creer", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(createFolder(OWNER_ID, WORLD_ID, { name: "X", parentId: null })).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(folderCreate).not.toHaveBeenCalled();
  });

  it("renameFolder : leve WorldNotFoundError pour un non-membre, sans modifier", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(renameFolder(OWNER_ID, WORLD_ID, "f1", { name: "X" })).rejects.toThrow(
      WorldNotFoundError,
    );
    expect(folderUpdate).not.toHaveBeenCalled();
  });

  it("moveFolder : leve WorldNotFoundError pour un non-membre, sans deplacer", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(moveFolder(OWNER_ID, WORLD_ID, "f1", null)).rejects.toThrow(WorldNotFoundError);
    expect(folderUpdate).not.toHaveBeenCalled();
  });

  it("deleteFolder : leve WorldNotFoundError pour un non-membre, sans supprimer", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(deleteFolder(OWNER_ID, WORLD_ID, "f1")).rejects.toThrow(WorldNotFoundError);
    expect(folderDelete).not.toHaveBeenCalled();
  });

  it("getFolderTree : leve WorldNotFoundError pour un non-membre, sans lire", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(getFolderTree(OWNER_ID, WORLD_ID)).rejects.toThrow(WorldNotFoundError);
    expect(folderFindMany).not.toHaveBeenCalled();
  });

  it("getUnfiledEntities : leve WorldNotFoundError pour un non-membre, sans lire", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(getUnfiledEntities(OWNER_ID, WORLD_ID)).rejects.toThrow(WorldNotFoundError);
    expect(entityFindMany).not.toHaveBeenCalled();
  });

  it("renameFolder : leve FolderNotFoundError si le dossier est d'un autre monde", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst.mockResolvedValueOnce(null);

    await expect(renameFolder(OWNER_ID, WORLD_ID, "f-autre-monde", { name: "X" })).rejects.toThrow(
      FolderNotFoundError,
    );
    expect(folderUpdate).not.toHaveBeenCalled();
  });
});

describe("createFolder", () => {
  it("cree un dossier racine (parentId null)", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderCreate.mockResolvedValueOnce(makeFolder({ id: "f1", parentId: null }));

    const folder = await createFolder(OWNER_ID, WORLD_ID, { name: "Personnages", parentId: null });

    expect(folderCreate).toHaveBeenCalledWith({
      data: { worldId: WORLD_ID, name: "Personnages", parentId: null },
    });
    expect(folder.parentId).toBeNull();
  });

  it("cree un dossier avec un parent existant du meme monde", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst.mockResolvedValueOnce(makeFolder({ id: "parent-1" }));
    folderCreate.mockResolvedValueOnce(makeFolder({ id: "f2", parentId: "parent-1" }));

    await createFolder(OWNER_ID, WORLD_ID, { name: "Sous-dossier", parentId: "parent-1" });

    expect(folderFindFirst).toHaveBeenCalledWith({ where: { id: "parent-1", worldId: WORLD_ID } });
    expect(folderCreate).toHaveBeenCalledWith({
      data: { worldId: WORLD_ID, name: "Sous-dossier", parentId: "parent-1" },
    });
  });

  it("leve FolderNotFoundError si le parentId indique n'existe pas (ou un autre monde)", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst.mockResolvedValueOnce(null);

    await expect(
      createFolder(OWNER_ID, WORLD_ID, { name: "X", parentId: "parent-inconnu" }),
    ).rejects.toThrow(FolderNotFoundError);
    expect(folderCreate).not.toHaveBeenCalled();
  });
});

describe("renameFolder", () => {
  it("renomme un dossier existant du monde", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst.mockResolvedValueOnce(makeFolder({ id: "f1", name: "Ancien nom" }));
    folderUpdate.mockResolvedValueOnce(makeFolder({ id: "f1", name: "Nouveau nom" }));

    const folder = await renameFolder(OWNER_ID, WORLD_ID, "f1", { name: "Nouveau nom" });

    expect(folderUpdate).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { name: "Nouveau nom" },
    });
    expect(folder.name).toBe("Nouveau nom");
  });
});

describe("moveFolder — invariants de structure (cycles)", () => {
  it("deplace vers un nouveau parent legitime", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst
      .mockResolvedValueOnce(makeFolder({ id: "f1", parentId: null })) // getFolder(folderId)
      .mockResolvedValueOnce(makeFolder({ id: "f2", parentId: null })) // getFolder(newParentId)
      .mockResolvedValueOnce(makeFolder({ id: "f2", parentId: null })); // assertNoCycle: cursor="f2"
    folderUpdate.mockResolvedValueOnce(makeFolder({ id: "f1", parentId: "f2" }));

    const folder = await moveFolder(OWNER_ID, WORLD_ID, "f1", "f2");

    expect(folderUpdate).toHaveBeenCalledWith({ where: { id: "f1" }, data: { parentId: "f2" } });
    expect(folder.parentId).toBe("f2");
  });

  it("deplace vers la racine (parentId null) sans verification de cycle", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst.mockResolvedValueOnce(makeFolder({ id: "f1", parentId: "f0" }));
    folderUpdate.mockResolvedValueOnce(makeFolder({ id: "f1", parentId: null }));

    await moveFolder(OWNER_ID, WORLD_ID, "f1", null);

    expect(folderUpdate).toHaveBeenCalledWith({ where: { id: "f1" }, data: { parentId: null } });
  });

  it("rejette le deplacement d'un dossier dans lui-meme (FolderCycleError)", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst
      .mockResolvedValueOnce(makeFolder({ id: "f1" })) // getFolder(folderId)
      .mockResolvedValueOnce(makeFolder({ id: "f1" })); // getFolder(newParentId="f1")

    await expect(moveFolder(OWNER_ID, WORLD_ID, "f1", "f1")).rejects.toThrow(FolderCycleError);
    expect(folderUpdate).not.toHaveBeenCalled();
  });

  it("rejette le deplacement d'un dossier dans l'un de ses descendants (arbre a 3 niveaux)", async () => {
    // root -> child -> grandchild ; on tente de deplacer root SOUS grandchild.
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst
      .mockResolvedValueOnce(makeFolder({ id: "root", parentId: null })) // getFolder("root")
      .mockResolvedValueOnce(makeFolder({ id: "grandchild", parentId: "child" })) // getFolder("grandchild")
      // assertNoCycle : remonte grandchild -> child -> root (atteint = cycle)
      .mockResolvedValueOnce(makeFolder({ id: "grandchild", parentId: "child" }))
      .mockResolvedValueOnce(makeFolder({ id: "child", parentId: "root" }));

    await expect(moveFolder(OWNER_ID, WORLD_ID, "root", "grandchild")).rejects.toThrow(
      FolderCycleError,
    );
    expect(folderUpdate).not.toHaveBeenCalled();
  });

  it("leve FolderNotFoundError si le nouveau parent n'existe pas (ou un autre monde)", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst
      .mockResolvedValueOnce(makeFolder({ id: "f1" })) // getFolder(folderId)
      .mockResolvedValueOnce(null); // getFolder(newParentId) absent

    await expect(moveFolder(OWNER_ID, WORLD_ID, "f1", "inconnu")).rejects.toThrow(
      FolderNotFoundError,
    );
    expect(folderUpdate).not.toHaveBeenCalled();
  });
});

describe("deleteFolder", () => {
  it("n'appelle que prisma.folder.delete — aucune manipulation manuelle d'entites ou de sous-dossiers", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst.mockResolvedValueOnce(makeFolder({ id: "f1" }));
    folderDelete.mockResolvedValueOnce(makeFolder({ id: "f1" }));

    await deleteFolder(OWNER_ID, WORLD_ID, "f1");

    expect(folderDelete).toHaveBeenCalledWith({ where: { id: "f1" } });
    expect(folderDelete).toHaveBeenCalledTimes(1);
    // Le mock Prisma n'expose meme pas entity.updateMany/folder.deleteMany :
    // un service qui tenterait de s'appuyer dessus planterait au typecheck
    // ou a l'execution - garde-fou contre une reimplementation manuelle qui
    // casserait l'atomicite native Postgres (voir dev-log : cascade
    // SetNull/Cascade verifiee manuellement contre le Postgres local).
  });

  it("leve FolderNotFoundError si le dossier est d'un autre monde, sans supprimer", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindFirst.mockResolvedValueOnce(null);

    await expect(deleteFolder(OWNER_ID, WORLD_ID, "f-autre-monde")).rejects.toThrow(
      FolderNotFoundError,
    );
    expect(folderDelete).not.toHaveBeenCalled();
  });
});

describe("getFolderTree", () => {
  it("construit l'arbre imbrique a partir de la liste a plat", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindMany.mockResolvedValueOnce([
      makeFolderWithEntities({ id: "root", parentId: null, name: "Racine" }),
      makeFolderWithEntities({ id: "child", parentId: "root", name: "Enfant" }),
      makeFolderWithEntities({ id: "other-root", parentId: null, name: "Autre racine" }),
    ]);

    const tree = await getFolderTree(OWNER_ID, WORLD_ID);

    expect(tree).toHaveLength(2);
    const root = tree.find((node) => node.id === "root");
    expect(root?.children).toHaveLength(1);
    expect(root?.children[0]?.id).toBe("child");
    expect(root?.children[0]?.children).toHaveLength(0);
  });

  it("renvoie un tableau vide pour un monde sans dossier", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindMany.mockResolvedValueOnce([]);

    const tree = await getFolderTree(OWNER_ID, WORLD_ID);

    expect(tree).toEqual([]);
  });

  it("porte les entites d'un dossier (KAN-60, include: entities) jusque dans le noeud renvoye", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    folderFindMany.mockResolvedValueOnce([
      makeFolderWithEntities({ id: "root", name: "Royaumes" }, [
        makeEntity({ id: "e1", folderId: "root" }),
      ]),
    ]);

    const tree = await getFolderTree(OWNER_ID, WORLD_ID);

    expect(tree[0]?.entities).toEqual([makeEntity({ id: "e1", folderId: "root" })]);
    expect(folderFindMany).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID },
      orderBy: { createdAt: "asc" },
      include: { entities: { orderBy: { createdAt: "desc" } } },
    });
  });
});

describe("frontiere type/dossier", () => {
  it("getUnfiledEntities : une entite sans dossier reste lisible avec son type intact", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    entityFindMany.mockResolvedValueOnce([
      makeEntity({ id: "e1", folderId: null, type: "character" }),
      makeEntity({ id: "e2", folderId: null, type: "place" }),
    ]);

    const entities = await getUnfiledEntities(OWNER_ID, WORLD_ID);

    expect(entityFindMany).toHaveBeenCalledWith({
      where: { worldId: WORLD_ID, folderId: null },
      orderBy: { createdAt: "desc" },
    });
    expect(entities.map((entity) => entity.type)).toEqual(["character", "place"]);
  });
});
