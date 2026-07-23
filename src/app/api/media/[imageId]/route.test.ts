import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import { requireSession } from "@/lib/auth-session";
import { storage } from "@/lib/storage";
import type { Image, World } from "@/generated/prisma/client";
import { WorldOrigin } from "@/generated/prisma/client";
import { GET } from "./route";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

// Meme regle que entity-service.test.ts : le port Prisma est mocke, mais
// getWorld() (world-service) n'est pas mocke - la vraie cascade d'autorisation
// tourne, pilotee par le mock world.findFirst.
vi.mock("@/db/client", () => ({
  prisma: {
    world: { findFirst: vi.fn() },
    image: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/storage", () => ({
  storage: { getSignedUrl: vi.fn() },
}));

const mockedRequireSession = vi.mocked(requireSession);
const worldFindFirst = vi.mocked(prisma.world.findFirst);
const imageFindUnique = vi.mocked(prisma.image.findUnique);
const getSignedUrl = vi.mocked(storage.getSignedUrl);
const fetchMock = vi.fn();

const OWNER_ID = "owner-1";
const WORLD_ID = "w1";

const SESSION = { user: { id: OWNER_ID } } as unknown as Awaited<ReturnType<typeof requireSession>>;

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

function callRoute(imageId: string) {
  return GET(new Request(`http://localhost:3000/api/media/${imageId}`), {
    params: Promise.resolve({ imageId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/media/[imageId]", () => {
  it("proxy le contenu de l'URL signee (jamais de redirection vers l'endpoint interne)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    imageFindUnique.mockResolvedValueOnce(makeImage());
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    getSignedUrl.mockResolvedValueOnce("http://minio:9000/signed-url");
    const body = new ReadableStream();
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));

    const response = await callRoute("img-1");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(getSignedUrl).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000000");
    expect(fetchMock).toHaveBeenCalledWith("http://minio:9000/signed-url");
  });

  it("renvoie 502 si le stockage est injoignable", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    imageFindUnique.mockResolvedValueOnce(makeImage());
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    getSignedUrl.mockResolvedValueOnce("http://minio:9000/signed-url");
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));

    const response = await callRoute("img-1");

    expect(response.status).toBe(502);
  });

  it("renvoie 502 si le stockage repond avec un statut d'erreur", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    imageFindUnique.mockResolvedValueOnce(makeImage());
    worldFindFirst.mockResolvedValueOnce(makeWorld());
    getSignedUrl.mockResolvedValueOnce("http://minio:9000/signed-url");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

    const response = await callRoute("img-1");

    expect(response.status).toBe(502);
  });

  it("renvoie 401 si la session est absente", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("no session"));

    const response = await callRoute("img-1");

    expect(response.status).toBe(401);
    expect(imageFindUnique).not.toHaveBeenCalled();
  });

  it("renvoie 404 si l'image n'existe pas", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    imageFindUnique.mockResolvedValueOnce(null);

    const response = await callRoute("unknown");

    expect(response.status).toBe(404);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("renvoie 404 (pas de fuite d'existence) si le monde de l'image n'appartient pas au proprietaire", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    imageFindUnique.mockResolvedValueOnce(makeImage());
    worldFindFirst.mockResolvedValueOnce(null);

    const response = await callRoute("img-1");

    expect(response.status).toBe(404);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
