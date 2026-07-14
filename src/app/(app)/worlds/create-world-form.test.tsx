import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateWorldForm } from "./create-world-form";
import { createWorldAction } from "@/actions/world";

vi.mock("@/actions/world", () => ({
  createWorldAction: vi.fn(),
}));

const mockedCreateWorldAction = vi.mocked(createWorldAction);

describe("CreateWorldForm", () => {
  beforeEach(() => {
    mockedCreateWorldAction.mockReset();
  });

  it("associe le label natif au champ nom", () => {
    render(<CreateWorldForm />);

    expect(screen.getByLabelText("Nom du monde")).toBeInTheDocument();
  });

  it("affiche un message d'erreur relie au formulaire en cas d'echec", async () => {
    mockedCreateWorldAction.mockResolvedValue({
      formError: "Création impossible pour le moment. Réessayez.",
      values: { name: "Eldoria" },
    });
    const user = userEvent.setup();
    render(<CreateWorldForm />);

    await user.type(screen.getByLabelText("Nom du monde"), "Eldoria");
    await user.click(screen.getByRole("button", { name: /créer le monde/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Création impossible pour le moment. Réessayez.");
  });

  it("reaffiche le nom saisi apres une erreur de validation", async () => {
    mockedCreateWorldAction.mockResolvedValue({
      errors: { name: "Le nom est requis." },
      values: { name: "   " },
    });
    const user = userEvent.setup();
    render(<CreateWorldForm />);

    await user.click(screen.getByRole("button", { name: /créer le monde/i }));

    await screen.findByText("Le nom est requis.");
    expect(screen.getByLabelText("Nom du monde")).toHaveValue("   ");
  });

  it("relie l'erreur du champ nom via aria-describedby et aria-invalid", async () => {
    mockedCreateWorldAction.mockResolvedValue({
      errors: { name: "Le nom est requis." },
      values: { name: "" },
    });
    const user = userEvent.setup();
    render(<CreateWorldForm />);

    await user.click(screen.getByRole("button", { name: /créer le monde/i }));

    const nameInput = await screen.findByLabelText("Nom du monde");
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAttribute("aria-describedby", "name-error");
    expect(screen.getByText("Le nom est requis.")).toHaveAttribute("id", "name-error");
  });
});
