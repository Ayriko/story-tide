import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import { storage } from "@/lib/storage";
import { env } from "@/env";
import type { Image, World } from "@/generated/prisma/client";
import { WorldOrigin } from "@/generated/prisma/client";
import { WorldNotFoundError } from "./world-service";
import { ImageStorageError, ImageValidationError, uploadImage } from "./image-service";

vi.mock("@/db/client", () => ({
  prisma: {
    world: {
      findFirst: vi.fn(),
    },
    image: {
      create: vi.fn(),
    },
  },
}));

// Meme regle que entity-service.test.ts pour @/lib/queue : mocker le port au
// niveau module (jamais MinIO reel dans un test unitaire).
vi.mock("@/lib/storage", () => ({
  storage: {
    upload: vi.fn(),
    delete: vi.fn(),
    getSignedUrl: vi.fn(),
  },
}));

const worldFindFirst = vi.mocked(prisma.world.findFirst);
const imageCreate = vi.mocked(prisma.image.create);
const storageUpload = vi.mocked(storage.upload);

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";

function makeWorld(overrides: Partial<World> = {}): World {
  return {
    id: WORLD_ID,
    ownerId: OWNER_ID,
    name: "Eldoria",
    slug: "eldoria",
    origin: WorldOrigin.USER,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeImage(overrides: Partial<Image> = {}): Image {
  return {
    id: "img-1",
    worldId: WORLD_ID,
    key: "00000000-0000-0000-0000-000000000000",
    contentType: "image/png",
    size: 10,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadImage", () => {
  it("valide, uploade vers le Storage et persiste les metadonnees quand tout est correct", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    storageUpload.mockResolvedValueOnce(undefined);
    imageCreate.mockResolvedValueOnce(makeImage({ id: "img-42" }));

    const result = await uploadImage(OWNER_ID, WORLD_ID, PNG_BUFFER);

    expect(storageUpload).toHaveBeenCalledWith({
      key: expect.any(String),
      body: PNG_BUFFER,
      contentType: "image/png",
    });
    expect(imageCreate).toHaveBeenCalledWith({
      data: {
        worldId: WORLD_ID,
        key: expect.any(String),
        contentType: "image/png",
        size: PNG_BUFFER.byteLength,
      },
    });
    expect(result).toEqual({ id: "img-42", src: `${env.BETTER_AUTH_URL}/api/media/img-42` });
  });

  it("leve WorldNotFoundError si le monde n'appartient pas au proprietaire, sans rien uploader", async () => {
    worldFindFirst.mockResolvedValueOnce(null);

    await expect(uploadImage(OWNER_ID, WORLD_ID, PNG_BUFFER)).rejects.toThrow(WorldNotFoundError);
    expect(storageUpload).not.toHaveBeenCalled();
    expect(imageCreate).not.toHaveBeenCalled();
  });

  it("leve ImageValidationError si l'image depasse la taille maximale, sans rien uploader", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    const oversized = Buffer.concat([PNG_BUFFER, Buffer.alloc(5_000_000)]);

    await expect(uploadImage(OWNER_ID, WORLD_ID, oversized)).rejects.toThrow(ImageValidationError);
    expect(storageUpload).not.toHaveBeenCalled();
    expect(imageCreate).not.toHaveBeenCalled();
  });

  it("leve ImageValidationError si le contenu ne correspond a aucune signature connue (faux MIME)", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    const fakeImage = Buffer.from("ceci n'est pas une image", "utf8");

    await expect(uploadImage(OWNER_ID, WORLD_ID, fakeImage)).rejects.toThrow(ImageValidationError);
    expect(storageUpload).not.toHaveBeenCalled();
    expect(imageCreate).not.toHaveBeenCalled();
  });

  it("chaine la cause reelle si le Storage echoue (jamais d'erreur avalee)", async () => {
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    const storageFailure = new Error("MinIO indisponible");
    storageUpload.mockRejectedValueOnce(storageFailure);

    const rejection = uploadImage(OWNER_ID, WORLD_ID, PNG_BUFFER);
    await expect(rejection).rejects.toThrow(ImageStorageError);
    await expect(rejection).rejects.toHaveProperty("cause", storageFailure);
    expect(imageCreate).not.toHaveBeenCalled();
  });
});
