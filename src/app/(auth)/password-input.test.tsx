import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "./password-input";
import { Label } from "@/components/ui/label";

function poser() {
  return render(
    <>
      <Label htmlFor="password">Mot de passe</Label>
      <PasswordInput id="password" name="password" autoComplete="new-password" />
    </>,
  );
}

describe("PasswordInput", () => {
  it("masque le mot de passe par defaut", () => {
    poser();

    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute("type", "password");
  });

  it("bascule l'affichage au clic, et revient en arriere", async () => {
    const user = userEvent.setup();
    poser();

    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Masquer le mot de passe" }));
    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute("type", "password");
  });

  it("annonce l'action disponible et designe le champ pilote", () => {
    poser();

    const bascule = screen.getByRole("button", { name: "Afficher le mot de passe" });
    expect(bascule).toHaveAttribute("aria-controls", "password");
    // type="button" : sans lui, la bascule soumettrait le formulaire parent.
    expect(bascule).toHaveAttribute("type", "button");
  });

  it("reste pilotable au clavier seul", async () => {
    const user = userEvent.setup();
    poser();

    await user.tab(); // champ
    expect(screen.getByLabelText("Mot de passe")).toHaveFocus();
    await user.tab(); // bascule
    expect(screen.getByRole("button", { name: "Afficher le mot de passe" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute("type", "text");
  });

  it("conserve la valeur saisie quand on bascule l'affichage", async () => {
    const user = userEvent.setup();
    poser();

    await user.type(screen.getByLabelText("Mot de passe"), "secret-du-testeur");
    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));

    expect(screen.getByLabelText("Mot de passe")).toHaveValue("secret-du-testeur");
  });
});
