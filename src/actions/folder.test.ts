import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import { WorldNotFoundError } from "@/services/world-service";
import { createFolder, deleteFolder, renameFolder } from "@/services/folder-service";
import { createFolderAction, deleteFolderAction, renameFolderAction } from "./folder";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/services/folder-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/folder-service")>();
  return {
    ...actual,
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
    deleteFolder: vi.fn(),
  };
});

const mockedRequireSession = vi.mocked(requireSession);
const mockedCreateFolder = vi.mocked(createFolder);
const mockedRenameFolder = vi.mocked(renameFolder);
const mockedDeleteFolder = vi.mocked(deleteFolder);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const SESSION = { user: { id: "owner-1" } } as unknown as Awaited<
  ReturnType<typeof requireSession>
>;

const FOLDER = {
  id: "f1",
  worldId: "w1",
  name: "Royaumes",
  parentId: null,
  seedRef: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

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

describe("createFolderAction", () => {
  it("cree le dossier et revalide uniquement le layout (jamais une navigation)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreateFolder.mockResolvedValueOnce(FOLDER);

    const result = await createFolderAction(
      {},
      formData({ worldId: "w1", name: "Royaumes", parentId: "" }),
    );

    expect(result).toEqual({});
    expect(mockedCreateFolder).toHaveBeenCalledWith("owner-1", "w1", {
      name: "Royaumes",
      parentId: null,
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(app)/worlds/[slug]", "layout");
  });

  it("un parentId non vide passe tel quel (creation d'un sous-dossier)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreateFolder.mockResolvedValueOnce(FOLDER);

    await createFolderAction({}, formData({ worldId: "w1", name: "Nord", parentId: "f-parent" }));

    expect(mockedCreateFolder).toHaveBeenCalledWith("owner-1", "w1", {
      name: "Nord",
      parentId: "f-parent",
    });
  });

  it("rejette un nom vide sans appeler le service", async () => {
    const result = await createFolderAction(
      {},
      formData({ worldId: "w1", name: "", parentId: "" }),
    );

    expect(result.errors?.name).toBeTruthy();
    expect(mockedCreateFolder).not.toHaveBeenCalled();
  });

  it("dossier parent introuvable renvoie une erreur generique", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreateFolder.mockRejectedValueOnce(new WorldNotFoundError());

    const result = await createFolderAction(
      {},
      formData({ worldId: "w1", name: "Royaumes", parentId: "" }),
    );

    expect(result.formError).toBe("Monde ou dossier parent introuvable.");
  });
});

describe("renameFolderAction", () => {
  it("renomme le dossier et revalide le layout", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedRenameFolder.mockResolvedValueOnce({ ...FOLDER, name: "Royaumes du Nord" });

    const result = await renameFolderAction(
      {},
      formData({ worldId: "w1", folderId: "f1", name: "Royaumes du Nord" }),
    );

    expect(result).toEqual({});
    expect(mockedRenameFolder).toHaveBeenCalledWith("owner-1", "w1", "f1", {
      name: "Royaumes du Nord",
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(app)/worlds/[slug]", "layout");
  });

  it("rejette un nom vide sans appeler le service", async () => {
    const result = await renameFolderAction(
      {},
      formData({ worldId: "w1", folderId: "f1", name: "" }),
    );

    expect(result.errors?.name).toBeTruthy();
    expect(mockedRenameFolder).not.toHaveBeenCalled();
  });
});

describe("deleteFolderAction", () => {
  it("supprime le dossier et revalide le layout", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedDeleteFolder.mockResolvedValueOnce(undefined);

    const result = await deleteFolderAction({}, formData({ worldId: "w1", folderId: "f1" }));

    expect(result).toEqual({});
    expect(mockedDeleteFolder).toHaveBeenCalledWith("owner-1", "w1", "f1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(app)/worlds/[slug]", "layout");
  });

  it("dossier introuvable renvoie une erreur generique sans revalider", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedDeleteFolder.mockRejectedValueOnce(new WorldNotFoundError());

    const result = await deleteFolderAction({}, formData({ worldId: "w1", folderId: "f1" }));

    expect(result).toEqual({ formError: "Dossier introuvable." });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("session expiree renvoie une erreur plutot que de rediriger", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("no session"));

    const result = await deleteFolderAction({}, formData({ worldId: "w1", folderId: "f1" }));

    expect(result).toEqual({ formError: "Session expirée. Reconnectez-vous." });
    expect(mockedDeleteFolder).not.toHaveBeenCalled();
  });
});
