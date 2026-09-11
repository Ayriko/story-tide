import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import { WorldNotFoundError } from "@/services/world-service";
import { FolderNotFoundError } from "@/services/folder-service";
import {
  createEntity,
  deleteEntity,
  moveEntityToFolder,
  searchEntities,
  updateEntity,
} from "@/services/entity-service";
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

const mockedRequireSession = vi.mocked(requireSession);
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
});

describe("searchEntitiesAction", () => {
  it("renvoie les resultats du service quand tout est correct", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedSearchEntities.mockResolvedValueOnce([
      { id: "e1", name: "Aeliana", type: "character", folderId: null },
    ]);

    const result = await searchEntitiesAction("w1", "Aeliana");

    expect(result).toEqual({
      ok: true,
      entities: [{ id: "e1", name: "Aeliana", type: "character", folderId: null }],
    });
    expect(mockedSearchEntities).toHaveBeenCalledWith("owner-1", "w1", "Aeliana");
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
