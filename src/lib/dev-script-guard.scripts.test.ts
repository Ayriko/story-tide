// Les scripts de developpement qui ecrivent en base (seed:intro,
// admin:promote) appellent la garde AVANT toute requete : on importe le vrai
// script (main() s'execute a l'import), avec Prisma, la file et les services
// mockes, et on verifie le refus sans aucun appel de donnees.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  seedIntroWorld: vi.fn(),
  promoteToAdmin: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  prisma: { user: { findUnique: mocks.findUnique }, $disconnect: vi.fn(async () => {}) },
}));
vi.mock("@/lib/queue", () => ({ jobQueue: { stop: vi.fn(async () => {}) } }));
vi.mock("@/services/intro-world-service", () => ({ seedIntroWorld: mocks.seedIntroWorld }));
vi.mock("@/services/admin-user-service", () => ({
  promoteToAdmin: mocks.promoteToAdmin,
  AdminUserNotFoundError: class AdminUserNotFoundError extends Error {},
}));

const LOCAL = "postgresql://story:pw@localhost:5432/story_tide";
const REMOTE = "postgresql://story:pw@db.storytide.fr:5432/story_tide";

const scripts = [
  { name: "seed:intro", path: "../../prisma/seed/run", argv: ["--owner-email=a@b.fr"] },
  { name: "admin:promote", path: "../../scripts/admin-promote", argv: ["a@b.fr"] },
] as const;

const cases = [
  { label: "NODE_ENV=production", nodeEnv: "production", databaseUrl: LOCAL },
  { label: "base non locale", nodeEnv: "development", databaseUrl: REMOTE },
] as const;

const originalArgv = process.argv;

describe("garde base locale des scripts de developpement", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe.each(scripts)("$name", (script) => {
    it.each(cases)("refuse ($label) avant toute requete", async (c) => {
      vi.stubEnv("NODE_ENV", c.nodeEnv);
      vi.stubEnv("DATABASE_URL", c.databaseUrl);
      // Arguments valides : le refus doit venir de la garde, pas de l'usage.
      process.argv = ["node", "script", ...script.argv];
      // process.exit renvoie `never` : on le neutralise pour garder le
      // runner en vie, le cast est inevitable pour un mock qui revient.
      const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      // Apres resetModules, la classe d'erreur doit venir du meme registre de
      // modules que le script, sinon instanceof compare deux classes.
      const { DevScriptRefusedError } = await import("./dev-script-guard");
      await import(script.path);

      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
      expect(consoleError.mock.calls[0]?.[1]).toBeInstanceOf(DevScriptRefusedError);
      expect(mocks.findUnique).not.toHaveBeenCalled();
      expect(mocks.seedIntroWorld).not.toHaveBeenCalled();
      expect(mocks.promoteToAdmin).not.toHaveBeenCalled();
    });
  });
});
