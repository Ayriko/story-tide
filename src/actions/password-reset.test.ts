import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RESET_REQUEST_CONFIRMATION } from "@/lib/auth-messages";
import { requestPasswordResetAction, resetPasswordAction } from "./auth";

// Fichier dedie au flux de reinitialisation (KAN-52) : auth.test.ts couvre
// deja registerAction/logoutAction et n'a pas a etre remanie.
vi.mock("@/lib/auth", () => ({
  auth: { api: { requestPasswordReset: vi.fn(), resetPassword: vi.fn() } },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockedRequestPasswordReset = vi.mocked(auth.api.requestPasswordReset);
const mockedResetPassword = vi.mocked(auth.api.resetPassword);
const mockedRedirect = vi.mocked(redirect);

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [cle, valeur] of Object.entries(fields)) {
    data.set(cle, valeur);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestPasswordResetAction", () => {
  it("refuse une adresse e-mail invalide sans rien envoyer", async () => {
    const state = await requestPasswordResetAction({}, formData({ email: "pas-une-adresse" }));

    expect(state.errors?.email).toBe("Adresse e-mail invalide.");
    expect(state.sent).toBeUndefined();
    expect(mockedRequestPasswordReset).not.toHaveBeenCalled();
  });

  it("reaffiche l'adresse saisie apres une erreur de saisie", async () => {
    const state = await requestPasswordResetAction({}, formData({ email: "pas-une-adresse" }));

    expect(state.values?.email).toBe("pas-une-adresse");
  });

  it("demande la reinitialisation en indiquant la page de retour", async () => {
    // @ts-expect-error - seul l'appel importe au test, pas la forme complete du retour Better Auth.
    mockedRequestPasswordReset.mockResolvedValue({ status: true });

    const state = await requestPasswordResetAction({}, formData({ email: "lectrice@example.com" }));

    expect(mockedRequestPasswordReset).toHaveBeenCalledWith({
      body: {
        email: "lectrice@example.com",
        redirectTo: expect.stringContaining("/reset-password"),
      },
    });
    expect(state.sent).toBe(true);
  });

  it("repond la meme chose que l'adresse corresponde ou non a un compte", async () => {
    // Better Auth ne leve pas pour une adresse inconnue : il renvoie le meme
    // statut. L'action ne doit donc rien distinguer non plus (OWASP A07).
    // @ts-expect-error - forme partielle suffisante au test.
    mockedRequestPasswordReset.mockResolvedValue({ status: true });

    const connue = await requestPasswordResetAction({}, formData({ email: "connue@example.com" }));
    const inconnue = await requestPasswordResetAction(
      {},
      formData({ email: "inconnue@example.com" }),
    );

    expect(inconnue.sent).toBe(connue.sent);
    expect(inconnue.formError).toBe(connue.formError);
    expect(inconnue.errors).toEqual(connue.errors);
  });

  it("ne trahit pas l'existence d'un compte meme quand l'envoi echoue, mais logue la cause", async () => {
    const erreurReelle = new Error("SMTP injoignable");
    mockedRequestPasswordReset.mockRejectedValue(erreurReelle);
    const spyErreur = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await requestPasswordResetAction({}, formData({ email: "lectrice@example.com" }));

    // Meme reponse que dans le cas nominal : une panne d'envoi ne doit pas
    // devenir un oracle d'existence de compte.
    expect(state.sent).toBe(true);
    expect(state.formError).toBeUndefined();
    // Mais la cause reelle n'est jamais avalee (regle CLAUDE.md).
    expect(spyErreur).toHaveBeenCalledWith(
      "[auth] Demande de réinitialisation échouée :",
      erreurReelle,
    );

    spyErreur.mockRestore();
  });

  it("expose un message de confirmation unique, sans reference au compte", () => {
    expect(RESET_REQUEST_CONFIRMATION).toContain("Si un compte existe");
  });
});

describe("resetPasswordAction", () => {
  it("refuse une demande sans jeton", async () => {
    const state = await resetPasswordAction(
      {},
      formData({ password: "nouveau-mot-de-passe", passwordConfirm: "nouveau-mot-de-passe" }),
    );

    expect(state.formError).toContain("invalide ou a expiré");
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it("refuse un mot de passe trop court sans consommer le jeton", async () => {
    const state = await resetPasswordAction(
      {},
      formData({ token: "jeton-valide", password: "court", passwordConfirm: "court" }),
    );

    expect(state.errors?.password).toBe("8 caractères minimum.");
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it("refuse une confirmation qui ne correspond pas, sans consommer le jeton", async () => {
    const state = await resetPasswordAction(
      {},
      formData({
        token: "jeton-valide",
        password: "nouveau-mot-de-passe",
        passwordConfirm: "pas-le-meme-mot-de-passe",
      }),
    );

    // L'erreur porte sur la confirmation : c'est elle que l'utilisateur corrige.
    expect(state.errors?.passwordConfirm).toBe("Les mots de passe ne correspondent pas.");
    expect(state.errors?.password).toBeUndefined();
    // Le jeton reste utilisable : une faute de frappe ne doit pas obliger a
    // redemander un lien.
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it("refuse une confirmation vide", async () => {
    const state = await resetPasswordAction(
      {},
      formData({ token: "jeton-valide", password: "nouveau-mot-de-passe", passwordConfirm: "" }),
    );

    expect(state.errors?.passwordConfirm).toBe("Confirmez le mot de passe.");
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it("transmet le nouveau mot de passe et le jeton, puis renvoie vers la connexion", async () => {
    mockedResetPassword.mockResolvedValue({ status: true });

    await resetPasswordAction(
      {},
      formData({
        token: "jeton-valide",
        password: "nouveau-mot-de-passe",
        passwordConfirm: "nouveau-mot-de-passe",
      }),
    );

    expect(mockedResetPassword).toHaveBeenCalledWith({
      body: { newPassword: "nouveau-mot-de-passe", token: "jeton-valide" },
    });
    // Pas de connexion automatique : un lien recu par courrier n'ouvre pas de session.
    expect(mockedRedirect).toHaveBeenCalledWith("/login?reinitialise=1");
  });

  it("traite un jeton expire ou deja utilise comme un cas metier, sans trace d'incident", async () => {
    const { APIError } = await import("better-auth");
    mockedResetPassword.mockRejectedValue(
      new APIError("BAD_REQUEST", { message: "invalid token" }),
    );
    const spyErreur = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await resetPasswordAction(
      {},
      formData({
        token: "jeton-perime",
        password: "nouveau-mot-de-passe",
        passwordConfirm: "nouveau-mot-de-passe",
      }),
    );

    expect(state.formError).toContain("invalide ou a expiré");
    // Un lien perime est attendu : ce n'est pas un incident a loguer.
    expect(spyErreur).not.toHaveBeenCalled();

    spyErreur.mockRestore();
  });

  it("logue la cause reelle d'une panne inattendue derriere le message generique", async () => {
    const erreurReelle = new Error("base injoignable");
    mockedResetPassword.mockRejectedValue(erreurReelle);
    const spyErreur = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await resetPasswordAction(
      {},
      formData({
        token: "jeton-valide",
        password: "nouveau-mot-de-passe",
        passwordConfirm: "nouveau-mot-de-passe",
      }),
    );

    expect(state.formError).toContain("impossible pour le moment");
    expect(spyErreur).toHaveBeenCalledWith(
      "[auth] Réinitialisation du mot de passe échouée :",
      erreurReelle,
    );

    spyErreur.mockRestore();
  });
});
