import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-session";
import { config, proxy } from "./proxy";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/auth-session", () => ({
  isAdmin: vi.fn(),
}));

const mockedGetSession = vi.mocked(auth.api.getSession);
const mockedIsAdmin = vi.mocked(isAdmin);

// Cast justifie : le proxy ne lit que session.user.id, pas le type Better
// Auth complet (meme raison que auth-session.test.ts).
const SESSION = { user: { id: "user-1" } } as unknown as Awaited<
  ReturnType<typeof auth.api.getSession>
>;

// En-tetes internes de Next : `x-middleware-rewrite` porte la destination
// d'une reecriture, `x-middleware-next` laisse passer la requete.
function rewriteTarget(response: Response): string | null {
  return response.headers.get("x-middleware-rewrite");
}

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("proxy /admin", () => {
  it("reecrit un anonyme vers la route inexistante, sans interroger le role", async () => {
    mockedGetSession.mockResolvedValueOnce(null);

    const response = await proxy(request("/admin"));

    expect(rewriteTarget(response)).toBe("http://localhost:3000/introuvable");
    expect(mockedIsAdmin).not.toHaveBeenCalled();
  });

  it("reecrit un compte standard vers la MEME route inexistante", async () => {
    mockedGetSession.mockResolvedValueOnce(SESSION);
    mockedIsAdmin.mockResolvedValueOnce(false);

    const response = await proxy(request("/admin/users/abc"));

    expect(rewriteTarget(response)).toBe("http://localhost:3000/introuvable");
    expect(mockedIsAdmin).toHaveBeenCalledWith("user-1");
  });

  it("laisse passer un administrateur, sans reecriture", async () => {
    mockedGetSession.mockResolvedValueOnce(SESSION);
    mockedIsAdmin.mockResolvedValueOnce(true);

    const response = await proxy(request("/admin/users"));

    expect(rewriteTarget(response)).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("reste ferme et logue la cause si la verification echoue (panne base)", async () => {
    const cause = new Error("panne base");
    mockedGetSession.mockRejectedValueOnce(cause);

    const response = await proxy(request("/admin"));

    expect(rewriteTarget(response)).toBe("http://localhost:3000/introuvable");
    expect(console.error).toHaveBeenCalledWith(
      "[admin] Vérification du rôle échouée dans le proxy :",
      cause,
    );
  });

  it("couvre /admin et tout ce qui est dessous, rien d'autre", () => {
    expect(config.matcher).toEqual(["/admin", "/admin/:path*"]);
  });
});
