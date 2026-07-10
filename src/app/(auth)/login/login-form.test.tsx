import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./login-form";
import { loginAction } from "@/actions/auth";

vi.mock("@/actions/auth", () => ({
  loginAction: vi.fn(),
}));

const mockedLoginAction = vi.mocked(loginAction);

describe("LoginForm", () => {
  beforeEach(() => {
    mockedLoginAction.mockReset();
  });

  it("associe les labels natifs aux champs e-mail et mot de passe", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
  });

  it("affiche un message d'erreur generique relie au formulaire en cas d'echec", async () => {
    mockedLoginAction.mockResolvedValue({ formError: "E-mail ou mot de passe incorrect." });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("E-mail"), "test@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("E-mail ou mot de passe incorrect.");
  });

  it("reaffiche l'e-mail saisi apres une erreur, mais jamais le mot de passe", async () => {
    mockedLoginAction.mockResolvedValue({
      errors: { email: "Adresse e-mail invalide." },
      values: { email: "not-an-email" },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("E-mail"), "not-an-email");
    await user.type(screen.getByLabelText("Mot de passe"), "whatever");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    await screen.findByText("Adresse e-mail invalide.");
    expect(screen.getByLabelText("E-mail")).toHaveValue("not-an-email");
    expect(screen.getByLabelText("Mot de passe")).toHaveValue("");
  });

  it("relie l'erreur du champ e-mail via aria-describedby et aria-invalid", async () => {
    mockedLoginAction.mockResolvedValue({
      errors: { email: "Adresse e-mail invalide." },
      values: { email: "not-an-email" },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("E-mail"), "not-an-email");
    await user.type(screen.getByLabelText("Mot de passe"), "whatever");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    const emailInput = await screen.findByLabelText("E-mail");
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(emailInput).toHaveAttribute("aria-describedby", "email-error");
    expect(screen.getByText("Adresse e-mail invalide.")).toHaveAttribute("id", "email-error");
  });
});
