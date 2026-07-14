import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireSession } from "@/lib/auth-session";
import { EMPTY_CONTENT } from "@/lib/tiptap-content";
import { EntityNotFoundError, updateEntityContent } from "@/services/entity-service";
import { WorldNotFoundError } from "@/services/world-service";
import { saveEntityContentAction } from "./entity-content";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/services/entity-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/entity-service")>();
  return { ...actual, updateEntityContent: vi.fn() };
});

const mockedRequireSession = vi.mocked(requireSession);
const mockedUpdateEntityContent = vi.mocked(updateEntityContent);

const SESSION = { user: { id: "owner-1" } } as unknown as Awaited<
  ReturnType<typeof requireSession>
>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveEntityContentAction", () => {
  it("valide, extrait le plainText et persiste quand tout est correct", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Salut" }] }],
    };
    mockedUpdateEntityContent.mockResolvedValueOnce(
      // @ts-expect-error - seul le retour importe au test, pas la forme Entity complete
      { id: "e1" },
    );

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(content));

    expect(result).toEqual({ ok: true });
    expect(mockedUpdateEntityContent).toHaveBeenCalledWith("owner-1", "w1", "e1", content, "Salut");
  });

  it("rejette une chaine JSON malformee sans appeler le service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);

    const result = await saveEntityContentAction("w1", "e1", "{ceci n'est pas du JSON");

    expect(result).toEqual({ ok: false, error: "Contenu invalide." });
    expect(mockedUpdateEntityContent).not.toHaveBeenCalled();
  });

  it("rejette un contenu invalide (JSON valide mais hors schema) sans appeler le service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);

    const result = await saveEntityContentAction(
      "w1",
      "e1",
      JSON.stringify({ type: "not-a-real-node" }),
    );

    expect(result).toEqual({ ok: false, error: "Contenu invalide." });
    expect(mockedUpdateEntityContent).not.toHaveBeenCalled();
  });

  it("retourne une erreur si la session est absente, sans appeler le service", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("no session"));

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(EMPTY_CONTENT));

    expect(result).toEqual({ ok: false, error: "Session expirée. Reconnectez-vous." });
    expect(mockedUpdateEntityContent).not.toHaveBeenCalled();
  });

  it("retourne une erreur 'fiche introuvable' si le monde n'appartient pas au proprietaire", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUpdateEntityContent.mockRejectedValueOnce(new WorldNotFoundError());

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(EMPTY_CONTENT));

    expect(result).toEqual({ ok: false, error: "Fiche introuvable." });
  });

  it("retourne une erreur 'fiche introuvable' si l'entite n'existe pas", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUpdateEntityContent.mockRejectedValueOnce(new EntityNotFoundError());

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(EMPTY_CONTENT));

    expect(result).toEqual({ ok: false, error: "Fiche introuvable." });
  });

  it("retourne une erreur generique pour tout autre echec du service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUpdateEntityContent.mockRejectedValueOnce(new Error("boom"));

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(EMPTY_CONTENT));

    expect(result).toEqual({ ok: false, error: "Enregistrement impossible pour le moment." });
  });
});
