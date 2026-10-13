import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import { UserRole } from "@/generated/prisma/client";
import { getServerSession } from "@/lib/auth";
import { makeUser } from "@/test-utils/make-user";
import { notFound, redirect } from "next/navigation";
import {
  AdminNotFoundError,
  UnauthenticatedError,
  isAdmin,
  requireAdmin,
  requireAdminOrNotFound,
  requireSession,
  requireSessionOrRedirect,
} from "./auth-session";

// La garde admin relit le role en base : Prisma mocke, aucune connexion reelle.
vi.mock("@/db/client", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getServerSession: vi.fn(),
}));

// notFound() reel leve pour interrompre le rendu : le mock fait de meme, sinon
// le test laisserait passer une garde qui "continue" apres un refus.
const NOT_FOUND_SIGNAL = "NEXT_NOT_FOUND (test)";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND (test)");
  }),
}));

const mockedGetServerSession = vi.mocked(getServerSession);
const mockedRedirect = vi.mocked(redirect);
const mockedNotFound = vi.mocked(notFound);
const userFindUnique = vi.mocked(prisma.user.findUnique);

// mockReset sur les deux mocks a file ...Once : clearAllMocks ne la vide pas
// (skill vitest-clearallmocks-once-queue).
beforeEach(() => {
  vi.clearAllMocks();
  mockedGetServerSession.mockReset();
  userFindUnique.mockReset();
});

// Cast justifie (les deux describe) : ces fonctions sont de simples
// passe-plats (retournent la session telle quelle ou levent/redirigent) -
// seule la forme minimale utile au test (user.id) importe, pas le type
// Better Auth complet (session, expiresAt...).
function fakeSession() {
  const session = { user: { id: "user-1" } };
  return session as unknown as Awaited<ReturnType<typeof getServerSession>>;
}

describe("requireSession", () => {
  it("retourne la session si elle existe", async () => {
    const session = fakeSession();
    mockedGetServerSession.mockResolvedValueOnce(session);

    await expect(requireSession()).resolves.toBe(session);
  });

  it("leve UnauthenticatedError si aucune session n'est active", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    await expect(requireSession()).rejects.toThrow(UnauthenticatedError);
  });
});

describe("requireSessionOrRedirect", () => {
  it("retourne la session si elle existe, sans rediriger", async () => {
    const session = fakeSession();
    mockedGetServerSession.mockResolvedValueOnce(session);

    await expect(requireSessionOrRedirect()).resolves.toBe(session);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("redirige vers /login si aucune session n'est active", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    await requireSessionOrRedirect();

    expect(mockedRedirect).toHaveBeenCalledWith("/login");
  });
});

describe("isAdmin", () => {
  it("relit le role en base, par identifiant, a chaque appel", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ role: UserRole.ADMIN }));

    await expect(isAdmin("user-1")).resolves.toBe(true);
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { role: true },
    });
  });

  it("vaut false pour un compte standard et pour un compte introuvable", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ role: UserRole.USER }));
    await expect(isAdmin("user-1")).resolves.toBe(false);

    userFindUnique.mockResolvedValueOnce(null);
    await expect(isAdmin("user-1")).resolves.toBe(false);
  });
});

describe("requireAdmin", () => {
  it("leve AdminNotFoundError pour un anonyme, sans interroger la base", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    await expect(requireAdmin()).rejects.toThrow(AdminNotFoundError);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("leve la MEME erreur pour un compte standard", async () => {
    mockedGetServerSession.mockResolvedValueOnce(fakeSession());
    userFindUnique.mockResolvedValueOnce(makeUser({ role: UserRole.USER }));

    await expect(requireAdmin()).rejects.toThrow(AdminNotFoundError);
  });

  it("retourne la session pour un administrateur", async () => {
    const session = fakeSession();
    mockedGetServerSession.mockResolvedValueOnce(session);
    userFindUnique.mockResolvedValueOnce(makeUser({ role: UserRole.ADMIN }));

    await expect(requireAdmin()).resolves.toBe(session);
  });

  it("ne fait pas confiance a la session : un role retire en base est refuse des l'appel suivant", async () => {
    const session = fakeSession();
    mockedGetServerSession.mockResolvedValue(session);
    userFindUnique
      .mockResolvedValueOnce(makeUser({ role: UserRole.ADMIN }))
      .mockResolvedValueOnce(makeUser({ role: UserRole.USER }));

    await expect(requireAdmin()).resolves.toBe(session);
    await expect(requireAdmin()).rejects.toThrow(AdminNotFoundError);
  });
});

describe("requireAdminOrNotFound", () => {
  it("appelle notFound() pour un anonyme (pas de redirection vers /login)", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    await expect(requireAdminOrNotFound()).rejects.toThrow(NOT_FOUND_SIGNAL);
    expect(mockedNotFound).toHaveBeenCalledTimes(1);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("appelle notFound() pour un compte standard", async () => {
    mockedGetServerSession.mockResolvedValueOnce(fakeSession());
    userFindUnique.mockResolvedValueOnce(makeUser({ role: UserRole.USER }));

    await expect(requireAdminOrNotFound()).rejects.toThrow(NOT_FOUND_SIGNAL);
    expect(mockedNotFound).toHaveBeenCalledTimes(1);
  });

  it("retourne la session pour un administrateur, sans notFound()", async () => {
    const session = fakeSession();
    mockedGetServerSession.mockResolvedValueOnce(session);
    userFindUnique.mockResolvedValueOnce(makeUser({ role: UserRole.ADMIN }));

    await expect(requireAdminOrNotFound()).resolves.toBe(session);
    expect(mockedNotFound).not.toHaveBeenCalled();
  });
});
