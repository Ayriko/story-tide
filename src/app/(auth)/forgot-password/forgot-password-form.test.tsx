import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordForm } from "./forgot-password-form";
import { requestPasswordResetAction } from "@/actions/auth";

vi.mock("@/actions/auth", () => ({
  requestPasswordResetAction: vi.fn(),
}));

const mockedAction = vi.mocked(requestPasswordResetAction);

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    mockedAction.mockReset();
  });

  it("associe un label natif au champ e-mail", () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
  });

  it("relie l'erreur du champ via aria-invalid et aria-describedby", async () => {
    mockedAction.mockResolvedValue({
      errors: { email: "Adresse e-mail invalide." },
      values: { email: "pas-une-adresse" },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("E-mail"), "pas-une-adresse");
    await user.click(screen.getByRole("button", { name: /envoyer le lien/i }));

    const champ = await screen.findByLabelText("E-mail");
    expect(champ).toHaveAttribute("aria-invalid", "true");
    expect(champ).toHaveAttribute("aria-describedby", "email-error");
    expect(screen.getByText("Adresse e-mail invalide.")).toHaveAttribute("id", "email-error");
  });

  it("affiche une confirmation neutre qui ne dit pas si le compte existe", async () => {
    mockedAction.mockResolvedValue({ sent: true, values: { email: "lectrice@example.com" } });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("E-mail"), "lectrice@example.com");
    await user.click(screen.getByRole("button", { name: /envoyer le lien/i }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent("Si un compte existe pour cette adresse");
    // Le formulaire disparait : reessayer serait le seul moyen de comparer
    // des reponses entre une adresse connue et une adresse inconnue.
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
  });

  it("reaffiche l'adresse saisie apres une erreur", async () => {
    mockedAction.mockResolvedValue({
      errors: { email: "Adresse e-mail invalide." },
      values: { email: "lectrice@example" },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("E-mail"), "lectrice@example");
    await user.click(screen.getByRole("button", { name: /envoyer le lien/i }));

    expect(await screen.findByLabelText("E-mail")).toHaveValue("lectrice@example");
  });
});
