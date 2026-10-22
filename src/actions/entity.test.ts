import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import { WorldNotFoundError } from "@/services/world-service";
import { FolderNotFoundError } from "@/services/folder-service";
import {
  EntityTypeHiddenError,
  EntityTypeNotFoundError,
  createEntity,
  deleteEntity,
  moveEntityToFolder,
  searchEntities,
  updateEntity,
} from "@/services/entity-service";
import { getWorldTypeCatalog } from "@/services/entity-type-service";
import {
  createEntityAction,
  deleteEntityAction,
  moveEntityToFolderAction,
  searchEntitiesAction,
  updateEntityAction,
} from "./entity";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/services/entity-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/entity-service")>();
  return {
    ...actual,
    searchEntities: vi.fn(),
    createEntity: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
    moveEntityToFolder: vi.fn(),
  };
});

// Catalogue des types (KAN-84) : mocke - sans lui, searchEntitiesAction
// taperait la vraie base et son catch generique masquerait l'echec.
vi.mock("@/services/entity-type-service", () => ({
  getWorldTypeCatalog: vi.fn(),
}));

const mockedRequireSession = vi.mocked(requireSession);
const mockedGetWorldTypeCatalog = vi.mocked(getWorldTypeCatalog);
const mockedSearchEntities = vi.mocked(searchEntities);
const mockedCreateEntity = vi.mocked(createEntity);
const mockedUpdateEntity = vi.mocked(updateEntity);
const mockedDeleteEntity = vi.mocked(deleteEntity);
const mockedMoveEntityToFolder = vi.mocked(moveEntityToFolder);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const SESSION = { user: { id: "owner-1" } } as unknown as Awaited<
  ReturnType<typeof requireSession>
>;

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetWorldTypeCatalog.mockResolvedValue({
    custom: [{ id: "ct1", label: "Vaisseau", group: "Objets", icon: "ship" }],
    hidden: [],
  });
});

describe("searchEntitiesAction", () => {
  it("renvoie les resultats avec leur type RESOLU, sans type brut (KAN-84)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedSearchEntities.mockResolvedValueOnce([
      { id: "e1", name: "Aeliana", type: "character", customTypeId: null, folderId: null },
      { id: "e2", name: "Albatros", type: "custom", customTypeId: "ct1", folderId: "f1" },
    ]);

    const result = await searchEntitiesAction("w1", "A");

    expect(result).toEqual({
      ok: true,
      entities: [
        {
          id: "e1",
          name: "Aeliana",
          folderId: null,
          resolvedType: expect.objectContaining({ key: "character", label: "Personnage" }),
        },
        {
          id: "e2",
          name: "Albatros",
          folderId: "f1",
          resolvedType: expect.objectContaining({
            key: "custom:ct1",
            label: "Vaisseau",
            group: "Objets",
          }),
        },
      ],
    });
    if (result.ok) {
      for (const entity of result.entities) {
        expect(entity).not.toHaveProperty("type");
        expect(entity).not.toHaveProperty("customTypeId");
      }
    }
    expect(mockedSearchEntities).toHaveBeenCalledWith("owner-1", "w1", "A");
    expect(mockedGetWorldTypeCatalog).toHaveBeenCalledWith("owner-1", "w1");
  });

  it("rejette une requete vide sans appeler le service", async () => {
    const result = await searchEntitiesAction("w1", "   ");

    expect(result).toEqual({ ok: false, error: "Saisir un terme." });
    expect(mockedSearchEntities).not.toHaveBeenCalled();
  });

  it("retourne une erreur si la session est absente, sans appeler le service", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("no session"));

    const result = await searchEntitiesAction("w1", "Aeliana");

    expect(result).toEqual({ ok: false, error: "Session expirée. Reconnectez-vous." });
    expect(mockedSearchEntities).not.toHaveBeenCalled();
  });

  it("retourne 'monde introuvable' si le monde n'appartient pas au proprietaire", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedSearchEntities.mockRejectedValueOnce(new WorldNotFoundError());

    const result = await searchEntitiesAction("w1", "Aeliana");

    expect(result).toEqual({ ok: false, error: "Monde introuvable." });
  });

  it("retourne une erreur generique pour tout autre echec du service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedSearchEntities.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await searchEntitiesAction("w1", "Aeliana");

    expect(result).toEqual({ ok: false, error: "Recherche impossible pour le moment." });
    expect(consoleError).toHaveBeenCalledWith(
      "[entity] Recherche de fiches échouée :",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});

// BUG-004 : createEntityAction ne revalidait que la PAGE du dashboard, jamais
// le LAYOUT du monde (worlds/[slug]/layout.tsx, qui porte la Sidebar via
// listEntities). Si ce layout est deja monte cote client (creation DEPUIS le
// dashboard, meme segment de monde), sa liste d'entites restait perimee tant
// qu'on ne revenait pas dessus - meme apres redirect(). Non-regression : la
// revalidation "layout" doit etre appelee en plus de celle en "page".
describe("createEntityAction", () => {
  it("revalide la page ET le layout du monde (Sidebar) avant de rediriger", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    // Seul entity.id est lu par l'action - cast justifie (convention
    // prisma-mock-partial-select : seuls les champs reellement lus sont fournis).
    mockedCreateEntity.mockResolvedValueOnce({ id: "e1" } as unknown as Awaited<
      ReturnType<typeof createEntity>
    >);

    await createEntityAction(
      {},
      formData({
        worldId: "w1",
        worldSlug: "monde-1",
        name: "Aldric",
        type: "character",
        aliases: "",
      }),
    );

    expect(mockedCreateEntity).toHaveBeenCalled();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/monde-1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(app)/worlds/[slug]", "layout");
  });

  // KAN-81 : le combobox poste type="custom" + customTypeId.
  it("transmet un type personnalise (custom + customTypeId) au service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreateEntity.mockResolvedValueOnce({ id: "e1" } as unknown as Awaited<
      ReturnType<typeof createEntity>
    >);

    await createEntityAction(
      {},
      formData({
        worldId: "w1",
        worldSlug: "monde-1",
        name: "Aube Grise",
        type: "custom",
        customTypeId: "ct-ship",
        aliases: "",
      }),
    );

    expect(mockedCreateEntity).toHaveBeenCalledWith(
      "owner-1",
      "w1",
      expect.objectContaining({ type: "custom", customTypeId: "ct-ship" }),
    );
  });

  it("un type introuvable (autre monde) devient une erreur du champ type, sans log", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreateEntity.mockRejectedValueOnce(new EntityTypeNotFoundError());
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await createEntityAction(
      {},
      formData({
        worldId: "w1",
        worldSlug: "monde-1",
        name: "Aube Grise",
        type: "custom",
        customTypeId: "ct-autrui",
        aliases: "",
      }),
    );

    expect(state.errors?.type).toBe("Type introuvable.");
    expect(state.values?.type).toBe("custom:ct-autrui");
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("updateEntityAction", () => {
  it("revalide la page de l'entree, la page du monde ET le layout du monde (Sidebar)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    // updateEntityAction n'exploite pas la valeur de retour - cast minimal
    // justifie (convention prisma-mock-partial-select).
    mockedUpdateEntity.mockResolvedValueOnce(
      {} as unknown as Awaited<ReturnType<typeof updateEntity>>,
    );

    await updateEntityAction(
      {},
      formData({
        worldId: "w1",
        worldSlug: "monde-1",
        entityId: "e1",
        name: "Aldric",
        type: "character",
        aliases: "",
      }),
    );

    expect(mockedUpdateEntity).toHaveBeenCalled();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/monde-1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/monde-1/entities/e1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(app)/worlds/[slug]", "layout");
  });

  it("un type natif masque devient une erreur du champ type (KAN-81)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUpdateEntity.mockRejectedValueOnce(new EntityTypeHiddenError());

    const state = await updateEntityAction(
      {},
      formData({
        worldId: "w1",
        worldSlug: "monde-1",
        entityId: "e1",
        name: "Aldric",
        type: "prophecy",
        aliases: "",
      }),
    );

    expect(state.errors?.type).toBe("Ce type n'est plus proposé dans ce monde.");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteEntityAction", () => {
  it("revalide la page du monde ET le layout du monde (Sidebar) avant de rediriger", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedDeleteEntity.mockResolvedValueOnce(undefined);

    await deleteEntityAction({}, formData({ worldId: "w1", worldSlug: "monde-1", entityId: "e1" }));

    expect(mockedDeleteEntity).toHaveBeenCalled();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/monde-1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(app)/worlds/[slug]", "layout");
  });
});

describe("moveEntityToFolderAction", () => {
  it("deplace l'entite vers le dossier indique et revalide uniquement le layout (jamais une navigation)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedMoveEntityToFolder.mockResolvedValueOnce({
      id: "e1",
      worldId: "w1",
      name: "Aeliana",
      type: "character",
      content: {},
      plainText: "",
      seedRef: null,
      folderId: "f1",
      contentVersion: 0,
      scannedVersion: 0,
      customTypeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      aliases: [],
    });

    const result = await moveEntityToFolderAction(
      {},
      formData({ worldId: "w1", entityId: "e1", folderId: "f1" }),
    );

    expect(result).toEqual({});
    expect(mockedMoveEntityToFolder).toHaveBeenCalledWith("owner-1", "w1", "e1", "f1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(app)/worlds/[slug]", "layout");
  });

  it("un champ folderId vide devient null (retire du dossier, jamais une chaine vide)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedMoveEntityToFolder.mockResolvedValueOnce({
      id: "e1",
      worldId: "w1",
      name: "Aeliana",
      type: "character",
      content: {},
      plainText: "",
      seedRef: null,
      folderId: null,
      contentVersion: 0,
      scannedVersion: 0,
      customTypeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      aliases: [],
    });

    await moveEntityToFolderAction({}, formData({ worldId: "w1", entityId: "e1", folderId: "" }));

    expect(mockedMoveEntityToFolder).toHaveBeenCalledWith("owner-1", "w1", "e1", null);
  });

  it("renvoie une erreur generique si l'entite ou le dossier est introuvable, sans rediriger", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedMoveEntityToFolder.mockRejectedValueOnce(new FolderNotFoundError());

    const result = await moveEntityToFolderAction(
      {},
      formData({ worldId: "w1", entityId: "e1", folderId: "f1" }),
    );

    expect(result).toEqual({ formError: "Entrée ou dossier introuvable." });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("session expiree renvoie une erreur plutot que de rediriger (appel hors formulaire)", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("no session"));

    const result = await moveEntityToFolderAction(
      {},
      formData({ worldId: "w1", entityId: "e1", folderId: "f1" }),
    );

    expect(result).toEqual({ formError: "Session expirée. Reconnectez-vous." });
    expect(mockedMoveEntityToFolder).not.toHaveBeenCalled();
  });
});
