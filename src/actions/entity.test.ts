import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireSession } from "@/lib/auth-session";
import { WorldNotFoundError } from "@/services/world-service";
import { searchEntities } from "@/services/entity-service";
import { searchEntitiesAction } from "./entity";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/services/entity-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/entity-service")>();
  return { ...actual, searchEntities: vi.fn() };
});

const mockedRequireSession = vi.mocked(requireSession);
const mockedSearchEntities = vi.mocked(searchEntities);

const SESSION = { user: { id: "owner-1" } } as unknown as Awaited<
  ReturnType<typeof requireSession>
>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchEntitiesAction", () => {
  it("renvoie les resultats du service quand tout est correct", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedSearchEntities.mockResolvedValueOnce([{ id: "e1", name: "Aeliana", type: "character" }]);

    const result = await searchEntitiesAction("w1", "Aeliana");

    expect(result).toEqual({
      ok: true,
      entities: [{ id: "e1", name: "Aeliana", type: "character" }],
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
