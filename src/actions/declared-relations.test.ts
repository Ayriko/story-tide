import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import {
  DeclaredRelationDuplicateError,
  DeclaredRelationNotFoundError,
  RelationTypeHiddenError,
  createDeclaredRelation,
  deleteDeclaredRelation,
  ignoreRelationSuggestion,
  unignoreRelationSuggestion,
} from "@/services/declared-relation-service";
import { EntityNotFoundError } from "@/services/entity-service";
import {
  createDeclaredRelationAction,
  deleteDeclaredRelationAction,
  ignoreRelationSuggestionAction,
  unignoreRelationSuggestionAction,
} from "./declared-relations";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Services mockes : jamais la vraie base (skill nonfatal-catch-hides-missing-mock).
vi.mock("@/services/declared-relation-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/declared-relation-service")>();
  return {
    ...actual,
    createDeclaredRelation: vi.fn(),
    deleteDeclaredRelation: vi.fn(),
    ignoreRelationSuggestion: vi.fn(),
    unignoreRelationSuggestion: vi.fn(),
  };
});

const mockedRequireSession = vi.mocked(requireSession);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedCreate = vi.mocked(createDeclaredRelation);
const mockedDelete = vi.mocked(deleteDeclaredRelation);
const mockedIgnore = vi.mocked(ignoreRelationSuggestion);
const mockedUnignore = vi.mocked(unignoreRelationSuggestion);

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

const CONTEXT = { worldId: "w1", worldSlug: "eldoria", entityId: "e-selyne" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createDeclaredRelationAction", () => {
  it("cree depuis la fiche puis revalide la source, la cible et les graphes", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreate.mockResolvedValueOnce({ sourceId: "e-aldric", targetId: "e-selyne" });

    const result = await createDeclaredRelationAction(
      {},
      formData({ ...CONTEXT, otherId: "e-aldric", choice: "parent|target" }),
    );

    expect(result).toEqual({ ok: true });
    expect(mockedCreate).toHaveBeenCalledWith("owner-1", "w1", "e-selyne", "e-aldric", {
      key: "parent",
      viewpoint: "target",
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/eldoria/entities/e-aldric");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/eldoria/entities/e-selyne");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/eldoria");
    expect(mockedRevalidatePath).not.toHaveBeenCalledWith("/worlds/eldoria/graph");
  });

  it("ni type ni entree : erreurs de champ, ni session ni service", async () => {
    const result = await createDeclaredRelationAction(
      {},
      formData({ ...CONTEXT, otherId: "", choice: "" }),
    );

    expect(result.errors).toEqual({
      otherId: "Choisis une entrée.",
      choice: "Choisis un type de relation.",
    });
    expect(mockedRequireSession).not.toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("session expiree : message, aucun appel au service", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("no session"));
    const result = await createDeclaredRelationAction(
      {},
      formData({ ...CONTEXT, otherId: "e-aldric", choice: "ally|source" }),
    );
    expect(result).toEqual({ formError: "Session expirée. Reconnectez-vous." });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("doublon : « Cette relation existe deja. »", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreate.mockRejectedValueOnce(new DeclaredRelationDuplicateError());
    const result = await createDeclaredRelationAction(
      {},
      formData({ ...CONTEXT, otherId: "e-aldric", choice: "ally|source" }),
    );
    expect(result).toEqual({ formError: "Cette relation existe déjà." });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("type masque : erreur sur le champ type", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreate.mockRejectedValueOnce(new RelationTypeHiddenError());
    const result = await createDeclaredRelationAction(
      {},
      formData({ ...CONTEXT, otherId: "e-aldric", choice: "rival|source" }),
    );
    expect(result.errors?.choice).toBe("Ce type de relation n'est plus proposé dans ce monde.");
  });

  it("entree d'un autre monde : « Entree introuvable. »", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreate.mockRejectedValueOnce(new EntityNotFoundError());
    const result = await createDeclaredRelationAction(
      {},
      formData({ ...CONTEXT, otherId: "e-ailleurs", choice: "ally|source" }),
    );
    expect(result).toEqual({ formError: "Entrée introuvable." });
  });

  it("panne inattendue : message generique et trace serveur", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    const failure = new Error("db down");
    mockedCreate.mockRejectedValueOnce(failure);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createDeclaredRelationAction(
      {},
      formData({ ...CONTEXT, otherId: "e-aldric", choice: "ally|source" }),
    );

    expect(result).toEqual({ formError: "Ajout impossible pour le moment. Réessayez." });
    expect(consoleError).toHaveBeenCalledWith(
      "[declared-relations] Création de relation échouée :",
      failure,
    );
    consoleError.mockRestore();
  });
});

describe("deleteDeclaredRelationAction", () => {
  it("supprime puis revalide les deux fiches", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedDelete.mockResolvedValueOnce({ sourceId: "e-selyne", targetId: "e-aldric" });

    const result = await deleteDeclaredRelationAction(
      {},
      formData({ worldId: "w1", worldSlug: "eldoria", relationId: "r1" }),
    );

    expect(result).toEqual({});
    expect(mockedDelete).toHaveBeenCalledWith("owner-1", "w1", "r1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/eldoria/entities/e-selyne");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/eldoria/entities/e-aldric");
  });

  it("relation introuvable : message, aucune revalidation", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedDelete.mockRejectedValueOnce(new DeclaredRelationNotFoundError());
    const result = await deleteDeclaredRelationAction(
      {},
      formData({ worldId: "w1", worldSlug: "eldoria", relationId: "r-ailleurs" }),
    );
    expect(result).toEqual({ formError: "Relation introuvable." });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("suggestions ignorees", () => {
  it("ignore puis revalide la fiche qui cite", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    const result = await ignoreRelationSuggestionAction(
      {},
      formData({ ...CONTEXT, targetId: "e-port" }),
    );
    expect(result).toEqual({});
    expect(mockedIgnore).toHaveBeenCalledWith("owner-1", "w1", "e-selyne", "e-port");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/eldoria/entities/e-selyne");
  });

  it("ne plus ignorer : entree introuvable -> message", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUnignore.mockRejectedValueOnce(new EntityNotFoundError());
    const result = await unignoreRelationSuggestionAction(
      {},
      formData({ ...CONTEXT, targetId: "e-port" }),
    );
    expect(result).toEqual({ formError: "Entrée introuvable." });
  });
});
