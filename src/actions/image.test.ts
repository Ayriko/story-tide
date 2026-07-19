import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireSession } from "@/lib/auth-session";
import { ImageStorageError, ImageValidationError, uploadImage } from "@/services/image-service";
import { WorldNotFoundError } from "@/services/world-service";
import { uploadImageAction } from "./image";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/services/image-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/image-service")>();
  return { ...actual, uploadImage: vi.fn() };
});

const mockedRequireSession = vi.mocked(requireSession);
const mockedUploadImage = vi.mocked(uploadImage);

const SESSION = { user: { id: "owner-1" } } as unknown as Awaited<
  ReturnType<typeof requireSession>
>;

function formDataWithFile(file: File | null): FormData {
  const formData = new FormData();
  if (file) {
    formData.set("file", file);
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadImageAction", () => {
  it("uploade et renvoie le src quand tout est correct", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUploadImage.mockResolvedValueOnce({
      id: "img-1",
      src: "http://localhost:3000/api/media/img-1",
    });
    const file = new File(["contenu"], "photo.png", { type: "image/png" });

    const result = await uploadImageAction("w1", formDataWithFile(file));

    expect(result).toEqual({ ok: true, src: "http://localhost:3000/api/media/img-1" });
    expect(mockedUploadImage).toHaveBeenCalledWith("owner-1", "w1", expect.any(Buffer));
  });

  it("retourne une erreur si la session est absente, sans appeler le service", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("no session"));

    const result = await uploadImageAction("w1", formDataWithFile(new File(["x"], "x.png")));

    expect(result).toEqual({ ok: false, error: "Session expirée. Reconnectez-vous." });
    expect(mockedUploadImage).not.toHaveBeenCalled();
  });

  it("retourne une erreur si aucun fichier n'est fourni, sans appeler le service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);

    const result = await uploadImageAction("w1", formDataWithFile(null));

    expect(result).toEqual({ ok: false, error: "Fichier manquant." });
    expect(mockedUploadImage).not.toHaveBeenCalled();
  });

  it("retourne 'monde introuvable' si le monde n'appartient pas au proprietaire", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUploadImage.mockRejectedValueOnce(new WorldNotFoundError());

    const result = await uploadImageAction("w1", formDataWithFile(new File(["x"], "x.png")));

    expect(result).toEqual({ ok: false, error: "Monde introuvable." });
  });

  it("retourne le message de validation si l'image est rejetee (taille/MIME)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUploadImage.mockRejectedValueOnce(
      new ImageValidationError("Type de fichier non pris en charge."),
    );

    const result = await uploadImageAction("w1", formDataWithFile(new File(["x"], "x.png")));

    expect(result).toEqual({ ok: false, error: "Type de fichier non pris en charge." });
  });

  it("logue la cause reelle et retourne un message generique si le stockage echoue", async () => {
    const cause = new Error("MinIO indisponible");
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUploadImage.mockRejectedValueOnce(new ImageStorageError(cause));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await uploadImageAction("w1", formDataWithFile(new File(["x"], "x.png")));

    expect(result).toEqual({ ok: false, error: "Envoi impossible pour le moment." });
    expect(consoleError).toHaveBeenCalledWith("[image] Envoi vers le stockage échoué :", cause);
    consoleError.mockRestore();
  });

  it("retourne une erreur generique pour tout autre echec inattendu", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUploadImage.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await uploadImageAction("w1", formDataWithFile(new File(["x"], "x.png")));

    expect(result).toEqual({ ok: false, error: "Envoi impossible pour le moment." });
    expect(consoleError).toHaveBeenCalledWith(
      "[image] Envoi de l'image échoué :",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
