import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordForm } from "./reset-password-form";
import { resetPasswordAction } from "@/actions/auth";

vi.mock("@/actions/auth", () => ({
  resetPasswordAction: vi.fn(),
}));

const mockedAction = vi.mocked(resetPasswordAction);

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    mockedAction.mockReset();
  });

  it("associe un label natif au champ de nouveau mot de passe", () => {
    render(<ResetPasswordForm token="jeton-valide" />);

    expect(screen.getByLabelText("Nouveau mot de passe")).toBeInTheDocument();
  });

  it("transporte le jeton sans jamais l'afficher a l'utilisateur", () => {
    const { container } = render(<ResetPasswordForm token="jeton-valide" />);

    const champCache = container.querySelector('input[name="token"]');
    expect(champCache).toHaveAttribute("type", "hidden");
    expect(champCache).toHaveValue("jeton-valide");
    expect(screen.queryByText("jeton-valide")).not.toBeInTheDocument();
  });

  it("annonce la contrainte de longueur avant toute erreur", () => {
    render(<ResetPasswordForm token="jeton-valide" />);

    const champ = screen.getByLabelText("Nouveau mot de passe");
    expect(champ).toHaveAttribute("aria-describedby", "password-aide");
    expect(screen.getByText("8 caractères minimum.")).toBeInTheDocument();
  });

  it("relie l'erreur du champ via aria-invalid et aria-describedby", async () => {
    mockedAction.mockResolvedValue({ errors: { password: "8 caractères minimum." } });
    const user = userEvent.setup();
    render(<ResetPasswordForm token="jeton-valide" />);

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "court");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    const champ = await screen.findByLabelText("Nouveau mot de passe");
    expect(champ).toHaveAttribute("aria-invalid", "true");
    expect(champ).toHaveAttribute("aria-describedby", "password-error");
  });

  it("propose de redemander un lien quand le jeton est refuse", async () => {
    mockedAction.mockResolvedValue({
      formError: "Ce lien de réinitialisation est invalide ou a expiré.",
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm token="jeton-perime" />);

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "nouveau-mot-de-passe");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("invalide ou a expiré");
    // Sans issue proposee, l'utilisateur reste bloque sur une page morte.
    expect(screen.getByRole("link", { name: /demander un nouveau lien/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("demande une confirmation du mot de passe", () => {
    render(<ResetPasswordForm token="jeton-valide" />);

    expect(screen.getByLabelText("Confirmer le mot de passe")).toBeInTheDocument();
  });

  it("relie l'erreur de correspondance au champ de confirmation", async () => {
    mockedAction.mockResolvedValue({
      errors: { passwordConfirm: "Les mots de passe ne correspondent pas." },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm token="jeton-valide" />);

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "nouveau-mot-de-passe");
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), "pas-le-meme");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    const confirmation = await screen.findByLabelText("Confirmer le mot de passe");
    expect(confirmation).toHaveAttribute("aria-invalid", "true");
    expect(confirmation).toHaveAttribute("aria-describedby", "passwordConfirm-error");
    expect(screen.getByText("Les mots de passe ne correspondent pas.")).toHaveAttribute(
      "id",
      "passwordConfirm-error",
    );
  });

  it("offre une bascule afficher/masquer sur chacun des deux champs", () => {
    render(<ResetPasswordForm token="jeton-valide" />);

    expect(screen.getAllByRole("button", { name: "Afficher le mot de passe" })).toHaveLength(2);
  });

  it("n'a pas de valeur par defaut sur le champ mot de passe", () => {
    render(<ResetPasswordForm token="jeton-valide" />);

    // Un secret ne se redepose jamais dans le DOM (meme regle que BUG-001).
    expect(screen.getByLabelText("Nouveau mot de passe")).toHaveValue("");
  });
});
