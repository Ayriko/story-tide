import { describe, expect, it, vi } from "vitest";
import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UnauthenticatedError, requireSession, requireSessionOrRedirect } from "./auth-session";

vi.mock("@/lib/auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockedGetServerSession = vi.mocked(getServerSession);
const mockedRedirect = vi.mocked(redirect);

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
