import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { logoutAction } from "./auth";

// Seule logoutAction est couverte ici : loginAction/registerAction n'ont pas
// de test dedie pre-existant (hors perimetre de cette tache, cf. CLAUDE.md
// "modifications chirurgicales").
vi.mock("@/lib/auth", () => ({
  auth: { api: { signOut: vi.fn() } },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockedSignOut = vi.mocked(auth.api.signOut);
const mockedRedirect = vi.mocked(redirect);

describe("logoutAction", () => {
  it("appelle signOut puis redirige vers /login", async () => {
    mockedSignOut.mockResolvedValueOnce({ success: true });

    await logoutAction();

    expect(mockedSignOut).toHaveBeenCalledTimes(1);
    expect(mockedRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirige quand meme vers /login si signOut echoue (jamais d'erreur avalee silencieusement)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedSignOut.mockRejectedValueOnce(new Error("session deja expiree"));

    await logoutAction();

    expect(mockedRedirect).toHaveBeenCalledWith("/login");
    expect(consoleErrorSpy).toHaveBeenCalledWith("[auth] Déconnexion échouée :", expect.any(Error));

    consoleErrorSpy.mockRestore();
  });
});
