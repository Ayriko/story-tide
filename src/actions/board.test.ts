import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-session";
import { replaceLayout, saveNodePositions, saveViewport } from "@/services/board-service";
import { EntityNotFoundError } from "@/services/entity-service";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { replaceLayoutAction, saveNodePositionsAction, saveViewportAction } from "./board";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Services mockes : jamais la vraie base (skill nonfatal-catch-hides-missing-mock).
vi.mock("@/services/board-service", () => ({
  saveNodePositions: vi.fn(),
  saveViewport: vi.fn(),
  replaceLayout: vi.fn(),
}));

vi.mock("@/services/world-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/world-service")>();
  return { ...actual, getWorldBySlug: vi.fn() };
});

const mockedRequireSession = vi.mocked(requireSession);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedSavePositions = vi.mocked(saveNodePositions);
const mockedSaveViewport = vi.mocked(saveViewport);
const mockedReplace = vi.mocked(replaceLayout);
const mockedGetWorldBySlug = vi.mocked(getWorldBySlug);

const SESSION = { user: { id: "owner-1" } } as unknown as Awaited<
  ReturnType<typeof requireSession>
>;
const WORLD = { id: "w1" } as unknown as Awaited<ReturnType<typeof getWorldBySlug>>;

beforeEach(() => {
  vi.resetAllMocks();
  mockedRequireSession.mockResolvedValue(SESSION);
  mockedGetWorldBySlug.mockResolvedValue(WORLD);
});

describe("saveNodePositionsAction", () => {
  it("positions valides : service appele avec le proprietaire et le monde resolu, aucun revalidatePath", async () => {
    const result = await saveNodePositionsAction("eldoria", [{ entityId: "e1", x: 1.5, y: -2 }]);

    expect(result).toEqual({ ok: true });
    expect(mockedGetWorldBySlug).toHaveBeenCalledWith("owner-1", "eldoria");
    expect(mockedSavePositions).toHaveBeenCalledWith("owner-1", "w1", [
      { entityId: "e1", x: 1.5, y: -2 },
    ]);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["coordonnee infinie", [{ entityId: "e1", x: Number.POSITIVE_INFINITY, y: 0 }]],
    ["NaN", [{ entityId: "e1", x: Number.NaN, y: 0 }]],
    ["hors bornes", [{ entityId: "e1", x: 1e6 + 1, y: 0 }]],
    ["id vide", [{ entityId: "", x: 0, y: 0 }]],
    ["pas un tableau", { entityId: "e1", x: 0, y: 0 }],
    [
      "plus de 1 000 positions",
      Array.from({ length: 1001 }, (_, index) => ({ entityId: `e${index}`, x: 0, y: 0 })),
    ],
  ])("%s : refuse a la frontiere, ni session ni service", async (_label, payload) => {
    const result = await saveNodePositionsAction("eldoria", payload);

    expect(result).toEqual({ ok: false, error: "Disposition invalide." });
    expect(mockedRequireSession).not.toHaveBeenCalled();
    expect(mockedSavePositions).not.toHaveBeenCalled();
  });

  it("1 000 positions : accepte (borne incluse)", async () => {
    const payload = Array.from({ length: 1000 }, (_, index) => ({
      entityId: `e${index}`,
      x: 1e6,
      y: -1e6,
    }));

    expect(await saveNodePositionsAction("eldoria", payload)).toEqual({ ok: true });
  });

  it("session expiree : message dedie, service jamais appele", async () => {
    mockedRequireSession.mockRejectedValue(new Error("no session"));

    const result = await saveNodePositionsAction("eldoria", []);

    expect(result).toEqual({ ok: false, error: "Session expirée. Reconnectez-vous." });
    expect(mockedSavePositions).not.toHaveBeenCalled();
  });

  it("monde d'un autre proprietaire : « introuvable »", async () => {
    mockedGetWorldBySlug.mockRejectedValue(new WorldNotFoundError());

    const result = await saveNodePositionsAction("pas-a-moi", [{ entityId: "e1", x: 0, y: 0 }]);

    expect(result).toEqual({ ok: false, error: "Entrée introuvable." });
    expect(mockedSavePositions).not.toHaveBeenCalled();
  });

  it("entree d'un autre monde : « introuvable »", async () => {
    mockedSavePositions.mockRejectedValue(new EntityNotFoundError());

    const result = await saveNodePositionsAction("eldoria", [{ entityId: "e-x", x: 0, y: 0 }]);

    expect(result).toEqual({ ok: false, error: "Entrée introuvable." });
  });

  it("erreur inattendue : message generique ET erreur reelle loguee", async () => {
    const failure = new Error("connexion perdue");
    mockedSavePositions.mockRejectedValue(failure);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await saveNodePositionsAction("eldoria", [{ entityId: "e1", x: 0, y: 0 }]);

    expect(result).toEqual({
      ok: false,
      error: "Sauvegarde de la disposition impossible pour le moment.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[board] Sauvegarde des positions échouée :",
      failure,
    );
    consoleError.mockRestore();
  });
});

describe("saveViewportAction", () => {
  it("cadrage valide : service appele, aucun revalidatePath", async () => {
    const result = await saveViewportAction("eldoria", { zoom: 1.2, panX: 30, panY: -12 });

    expect(result).toEqual({ ok: true });
    expect(mockedSaveViewport).toHaveBeenCalledWith("owner-1", "w1", {
      zoom: 1.2,
      panX: 30,
      panY: -12,
    });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["zoom sous la borne", { zoom: 0.05, panX: 0, panY: 0 }],
    ["zoom au-dessus de la borne", { zoom: 4.5, panX: 0, panY: 0 }],
    ["zoom nul", { zoom: 0, panX: 0, panY: 0 }],
    ["pan manquant", { zoom: 1, panX: 0 }],
    ["pan infini", { zoom: 1, panX: Number.NEGATIVE_INFINITY, panY: 0 }],
  ])("%s : refuse a la frontiere", async (_label, payload) => {
    const result = await saveViewportAction("eldoria", payload);

    expect(result).toEqual({ ok: false, error: "Disposition invalide." });
    expect(mockedSaveViewport).not.toHaveBeenCalled();
  });

  it("slug absent : refuse", async () => {
    expect(await saveViewportAction("", { zoom: 1, panX: 0, panY: 0 })).toEqual({
      ok: false,
      error: "Disposition invalide.",
    });
  });
});

describe("replaceLayoutAction", () => {
  it("remplace la disposition, aucun revalidatePath", async () => {
    const result = await replaceLayoutAction("eldoria", [{ entityId: "e1", x: 0, y: 0 }]);

    expect(result).toEqual({ ok: true });
    expect(mockedReplace).toHaveBeenCalledWith("owner-1", "w1", [{ entityId: "e1", x: 0, y: 0 }]);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("erreur inattendue : log dedie", async () => {
    const failure = new Error("boom");
    mockedReplace.mockRejectedValue(failure);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await replaceLayoutAction("eldoria", []);

    expect(consoleError).toHaveBeenCalledWith(
      "[board] Remplacement de la disposition échoué :",
      failure,
    );
    consoleError.mockRestore();
  });
});
