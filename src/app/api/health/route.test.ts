import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import { env } from "@/env";
import { GET } from "./route";

vi.mock("@/db/client", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

// Objet mutable (pas un enum Zod fige) : chaque test peut ajuster
// NODE_ENV/COMMIT_SHA sans reimporter le module.
vi.mock("@/env", () => ({
  env: { NODE_ENV: "production", COMMIT_SHA: undefined },
}));

const queryRaw = vi.mocked(prisma.$queryRaw);

beforeEach(() => {
  vi.clearAllMocks();
  env.NODE_ENV = "production";
  env.COMMIT_SHA = undefined;
});

describe("GET /api/health", () => {
  it("renvoie 200 avec le statut nominal quand la base repond", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      status: "ok",
      version: "0.1.0",
      uptime: expect.any(Number),
      checks: { db: "ok" },
    });
  });

  it("renvoie 503 si la base echoue", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connexion refusee"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "degraded", checks: { db: "error" } });
    consoleError.mockRestore();
  });

  it("renvoie 503 si la base ne repond pas dans le delai imparti (timeout)", async () => {
    vi.useFakeTimers();
    // Promesse jamais resolue : simule une base qui ne repond plus. Cast
    // necessaire - $queryRaw type sa valeur de retour en PrismaPromise (tag
    // interne), qu'une Promise brute ne peut pas satisfaire structurellement.
    queryRaw.mockReturnValueOnce(new Promise(() => {}) as ReturnType<typeof prisma.$queryRaw>);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const responsePromise = GET();
    await vi.advanceTimersByTimeAsync(2_000);
    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "degraded", checks: { db: "error" } });
    consoleError.mockRestore();
    vi.useRealTimers();
  });

  it("ne fuite jamais le message d'erreur d'origine dans le corps de la reponse", async () => {
    const realError = new Error("SECRET_DSN_LEAK://user:pass@host/db");
    queryRaw.mockRejectedValueOnce(realError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const text = await response.text();

    expect(text).not.toContain("SECRET_DSN_LEAK");
    expect(consoleError).toHaveBeenCalledWith(
      "[health] Sonde base de données échouée :",
      realError,
    );
    consoleError.mockRestore();
  });

  it("n'inclut pas le SHA de commit en production, meme si COMMIT_SHA est defini", async () => {
    env.NODE_ENV = "production";
    env.COMMIT_SHA = "abc1234";
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(body.commit).toBeUndefined();
  });

  it("inclut le SHA de commit hors production quand COMMIT_SHA est defini", async () => {
    env.NODE_ENV = "development";
    env.COMMIT_SHA = "abc1234";
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(body.commit).toBe("abc1234");
  });
});
