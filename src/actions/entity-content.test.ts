import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireSession } from "@/lib/auth-session";
import { jobQueue } from "@/lib/queue";
import { ENTITY_LINKING_QUEUE } from "@/lib/queue/entity-linking";
import { EMPTY_CONTENT } from "@/lib/tiptap-content";
import { EntityNotFoundError, updateEntityContent } from "@/services/entity-service";
import { reconcileManualMentions } from "@/services/relation-service";
import { WorldNotFoundError } from "@/services/world-service";
import { saveEntityContentAction } from "./entity-content";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/queue", () => ({
  jobQueue: { enqueue: vi.fn() },
}));

vi.mock("@/services/entity-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/entity-service")>();
  return { ...actual, updateEntityContent: vi.fn() };
});

// Sans ce mock, reconcileManualMentions() appellerait la VRAIE @/db/client -
// si un Postgres dev tourne par ailleurs (docker-compose.dev.yml), l'appel
// reussirait/echouerait silencieusement contre la vraie base au lieu d'etre
// isole (piege reel rencontre en verifiant ce fichier : les tests passaient
// deja "par accident" via l'echec catche, sans jamais verifier l'appel).
vi.mock("@/services/relation-service", () => ({
  reconcileManualMentions: vi.fn(),
}));

const mockedRequireSession = vi.mocked(requireSession);
const mockedUpdateEntityContent = vi.mocked(updateEntityContent);
const mockedReconcileManualMentions = vi.mocked(reconcileManualMentions);
const mockedEnqueue = vi.mocked(jobQueue.enqueue);

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

  it("rejette une chaine JSON trop volumineuse sans meme tenter de la parser", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    const oversized = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(1_000_001) }] }],
    });

    const result = await saveEntityContentAction("w1", "e1", oversized);

    expect(result).toEqual({ ok: false, error: "Contenu trop volumineux." });
    expect(mockedUpdateEntityContent).not.toHaveBeenCalled();
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

    expect(result).toEqual({ ok: false, error: "Entrée introuvable." });
  });

  it("retourne une erreur 'fiche introuvable' si l'entite n'existe pas", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUpdateEntityContent.mockRejectedValueOnce(new EntityNotFoundError());

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(EMPTY_CONTENT));

    expect(result).toEqual({ ok: false, error: "Entrée introuvable." });
  });

  it("retourne une erreur generique pour tout autre echec du service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUpdateEntityContent.mockRejectedValueOnce(new Error("boom"));

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(EMPTY_CONTENT));

    expect(result).toEqual({ ok: false, error: "Enregistrement impossible pour le moment." });
  });

  it("enfile un job de liaison apres un enregistrement reussi, avec singletonKey=entityId", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    // @ts-expect-error - seul le retour importe au test, pas la forme Entity complete
    mockedUpdateEntityContent.mockResolvedValueOnce({ id: "e1" });
    mockedEnqueue.mockResolvedValueOnce("job-1");

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(EMPTY_CONTENT));

    expect(result).toEqual({ ok: true });
    expect(mockedEnqueue).toHaveBeenCalledWith(
      ENTITY_LINKING_QUEUE,
      { worldId: "w1", entityId: "e1" },
      { singletonKey: "e1" },
    );
  });

  it("un enfilage en echec est loggue mais ne fait pas echouer la sauvegarde (contenu deja persiste)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    // @ts-expect-error - seul le retour importe au test, pas la forme Entity complete
    mockedUpdateEntityContent.mockResolvedValueOnce({ id: "e1" });
    mockedEnqueue.mockRejectedValueOnce(new Error("file indisponible"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(EMPTY_CONTENT));

    expect(result).toEqual({ ok: true });
    expect(consoleError).toHaveBeenCalledWith(
      "[entity-content] Enfilage du job de liaison échoué :",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("reconcilie les Relation MANUAL avec les mentions extraites du contenu sauvegarde", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    // @ts-expect-error - seul le retour importe au test, pas la forme Entity complete
    mockedUpdateEntityContent.mockResolvedValueOnce({ id: "e1" });
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "mention", attrs: { id: "e2", label: "Aeliana" } }],
        },
      ],
    };

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(content));

    expect(result).toEqual({ ok: true });
    expect(mockedReconcileManualMentions).toHaveBeenCalledWith("owner-1", "w1", "e1", ["e2"]);
  });

  it("une reconciliation MANUAL en echec est loggue mais ne fait pas echouer la sauvegarde", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    // @ts-expect-error - seul le retour importe au test, pas la forme Entity complete
    mockedUpdateEntityContent.mockResolvedValueOnce({ id: "e1" });
    mockedReconcileManualMentions.mockRejectedValueOnce(new Error("base indisponible"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await saveEntityContentAction("w1", "e1", JSON.stringify(EMPTY_CONTENT));

    expect(result).toEqual({ ok: true });
    expect(consoleError).toHaveBeenCalledWith(
      "[entity-content] Réconciliation des mentions manuelles échouée :",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
