import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { seedIntroWorld } from "@/services/intro-world-service";
import { logoutAction, registerAction } from "./auth";

// logoutAction et registerAction sont couverts (loginAction n'a pas de test
// dedie pre-existant, hors perimetre de cette tache - CLAUDE.md "modifications
// chirurgicales").
vi.mock("@/lib/auth", () => ({
  auth: { api: { signOut: vi.fn(), signUpEmail: vi.fn() } },
}));

vi.mock("@/services/intro-world-service", () => ({
  seedIntroWorld: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockedSignOut = vi.mocked(auth.api.signOut);
const mockedSignUpEmail = vi.mocked(auth.api.signUpEmail);
const mockedSeedIntroWorld = vi.mocked(seedIntroWorld);
const mockedRedirect = vi.mocked(redirect);

function registerFormData(fields: Record<string, string>, skipIntroWorld = false): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  if (skipIntroWorld) {
    data.set("skipIntroWorld", "on");
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

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

// Diagnostic normalisation Unicode / BUG-005 non concerne ici - couvre
// uniquement le nouveau branchement KAN-35 (seedIntroWorld apres inscription,
// sautable via la case a cocher).
describe("registerAction", () => {
  const VALID_FIELDS = {
    name: "Test User",
    email: "test@story-tide.test",
    password: "mot-de-passe-1234",
  };

  it("seede le monde d'introduction apres une inscription reussie, sans la case cochee", async () => {
    // @ts-expect-error - seul user.id importe au test, pas la forme complete du retour Better Auth.
    mockedSignUpEmail.mockResolvedValueOnce({ user: { id: "user-1" } });

    await registerAction({}, registerFormData(VALID_FIELDS));

    expect(mockedSeedIntroWorld).toHaveBeenCalledWith("user-1");
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it("ne seede PAS le monde d'introduction quand la case 'ne pas creer' est cochee", async () => {
    // @ts-expect-error - seul user.id importe au test, pas la forme complete du retour Better Auth.
    mockedSignUpEmail.mockResolvedValueOnce({ user: { id: "user-2" } });

    await registerAction({}, registerFormData(VALID_FIELDS, true));

    expect(mockedSeedIntroWorld).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it("un echec du seed est loggue mais ne bloque pas l'inscription (redirection quand meme)", async () => {
    // @ts-expect-error - seul user.id importe au test, pas la forme complete du retour Better Auth.
    mockedSignUpEmail.mockResolvedValueOnce({ user: { id: "user-3" } });
    mockedSeedIntroWorld.mockRejectedValueOnce(new Error("base indisponible"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await registerAction({}, registerFormData(VALID_FIELDS));

    expect(mockedRedirect).toHaveBeenCalledWith("/");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[auth] Seed du monde d'introduction échoué :",
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it("n'appelle ni signUpEmail ni seedIntroWorld si la validation Zod echoue", async () => {
    const result = await registerAction(
      {},
      registerFormData({ ...VALID_FIELDS, email: "pas-un-email" }),
    );

    expect(result.errors?.email).toBeDefined();
    expect(mockedSignUpEmail).not.toHaveBeenCalled();
    expect(mockedSeedIntroWorld).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("ne seede pas si le compte existe deja (USER_ALREADY_EXISTS)", async () => {
    const { APIError } = await import("better-auth");
    mockedSignUpEmail.mockRejectedValueOnce(
      new APIError(422, { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }),
    );

    const result = await registerAction({}, registerFormData(VALID_FIELDS));

    expect(result.errors?.email).toBe("Un compte existe déjà avec cette adresse e-mail.");
    expect(mockedSeedIntroWorld).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
