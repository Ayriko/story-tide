import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireSession } from "@/lib/auth-session";
import { revalidatePath } from "next/cache";
import { EntityNotFoundError } from "@/services/entity-service";
import { ignoreLink, unignoreLink } from "@/services/relation-service";
import { WorldNotFoundError } from "@/services/world-service";
import { ignoreLinkAction, unignoreLinkAction } from "./link-ignore";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Sans ce mock, ignoreLink/unignoreLink appelleraient la VRAIE @/db/client -
// meme piege que celui documente pour entity-content.test.ts (skill
// nonfatal-catch-hides-missing-mock) : un try/catch non-fatal peut avaler un
// echec contre une vraie base sans jamais le signaler.
vi.mock("@/services/relation-service", () => ({
  ignoreLink: vi.fn(),
  unignoreLink: vi.fn(),
}));

const mockedRequireSession = vi.mocked(requireSession);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedIgnoreLink = vi.mocked(ignoreLink);
const mockedUnignoreLink = vi.mocked(unignoreLink);

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

describe("ignoreLinkAction", () => {
  it("retourne une erreur si la session est absente, sans appeler le service", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("no session"));

    const result = await ignoreLinkAction(
      {},
      formData({ worldId: "w1", worldSlug: "eldoria", entityId: "e1", targetId: "e2" }),
    );

    expect(result).toEqual({ formError: "Session expirée. Reconnectez-vous." });
    expect(mockedIgnoreLink).not.toHaveBeenCalled();
  });

  it("appelle ignoreLink puis revalide la page de la fiche, en cas de succes", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedIgnoreLink.mockResolvedValueOnce(undefined);

    const result = await ignoreLinkAction(
      {},
      formData({ worldId: "w1", worldSlug: "eldoria", entityId: "e1", targetId: "e2" }),
    );

    expect(result).toEqual({});
    expect(mockedIgnoreLink).toHaveBeenCalledWith("owner-1", "w1", "e1", "e2");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/eldoria/entities/e1");
  });

  it("retourne une erreur 'fiche introuvable' si le monde n'appartient pas au proprietaire", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedIgnoreLink.mockRejectedValueOnce(new WorldNotFoundError());

    const result = await ignoreLinkAction(
      {},
      formData({ worldId: "w1", worldSlug: "eldoria", entityId: "e1", targetId: "e2" }),
    );

    expect(result).toEqual({ formError: "Fiche introuvable." });
  });

  it("retourne une erreur 'fiche introuvable' si l'entite n'existe pas", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedIgnoreLink.mockRejectedValueOnce(new EntityNotFoundError());

    const result = await ignoreLinkAction(
      {},
      formData({ worldId: "w1", worldSlug: "eldoria", entityId: "e1", targetId: "e2" }),
    );

    expect(result).toEqual({ formError: "Fiche introuvable." });
  });

  it("retourne une erreur generique pour tout autre echec, loggue sans l'avaler", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedIgnoreLink.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await ignoreLinkAction(
      {},
      formData({ worldId: "w1", worldSlug: "eldoria", entityId: "e1", targetId: "e2" }),
    );

    expect(result).toEqual({ formError: "Action impossible pour le moment. Réessayez." });
    expect(consoleError).toHaveBeenCalledWith(
      "[link-ignore] Ignorer le lien a échoué :",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});

describe("unignoreLinkAction", () => {
  it("appelle unignoreLink puis revalide la page de la fiche, en cas de succes", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUnignoreLink.mockResolvedValueOnce(undefined);

    const result = await unignoreLinkAction(
      {},
      formData({ worldId: "w1", worldSlug: "eldoria", entityId: "e1", targetId: "e2" }),
    );

    expect(result).toEqual({});
    expect(mockedUnignoreLink).toHaveBeenCalledWith("owner-1", "w1", "e1", "e2");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/worlds/eldoria/entities/e1");
  });

  it("retourne une erreur generique pour tout echec, loggue sans l'avaler", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUnignoreLink.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await unignoreLinkAction(
      {},
      formData({ worldId: "w1", worldSlug: "eldoria", entityId: "e1", targetId: "e2" }),
    );

    expect(result).toEqual({ formError: "Action impossible pour le moment. Réessayez." });
    expect(consoleError).toHaveBeenCalledWith(
      "[link-ignore] Ne plus ignorer le lien a échoué :",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
