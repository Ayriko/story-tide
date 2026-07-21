import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateEntityForm } from "./create-entity-form";
import { createEntityAction } from "@/actions/entity";

vi.mock("@/actions/entity", () => ({
  createEntityAction: vi.fn(),
}));

const mockedCreateEntityAction = vi.mocked(createEntityAction);

describe("CreateEntityForm", () => {
  beforeEach(() => {
    mockedCreateEntityAction.mockReset();
  });

  it("associe les labels natifs aux champs nom, type et alias", () => {
    render(<CreateEntityForm worldId="w1" worldSlug="eldoria" />);

    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Alias (un par ligne)")).toBeInTheDocument();
  });

  it("affiche un message d'erreur relie au formulaire en cas d'echec", async () => {
    mockedCreateEntityAction.mockResolvedValue({
      formError: "Création impossible pour le moment. Réessayez.",
      values: { name: "Aeliana", type: "character", aliases: "" },
    });
    const user = userEvent.setup();
    render(<CreateEntityForm worldId="w1" worldSlug="eldoria" />);

    await user.type(screen.getByLabelText("Nom"), "Aeliana");
    await user.click(screen.getByTestId("create-entity-submit"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Création impossible pour le moment. Réessayez.");
  });

  it("reaffiche le nom saisi apres une erreur de validation", async () => {
    mockedCreateEntityAction.mockResolvedValue({
      errors: { name: "Le nom est requis." },
      values: { name: "   ", type: "character", aliases: "" },
    });
    const user = userEvent.setup();
    render(<CreateEntityForm worldId="w1" worldSlug="eldoria" />);

    await user.click(screen.getByTestId("create-entity-submit"));

    await screen.findByText("Le nom est requis.");
    expect(screen.getByLabelText("Nom")).toHaveValue("   ");
  });

  it("relie l'erreur du champ nom via aria-describedby et aria-invalid", async () => {
    mockedCreateEntityAction.mockResolvedValue({
      errors: { name: "Le nom est requis." },
      values: { name: "", type: "character", aliases: "" },
    });
    const user = userEvent.setup();
    render(<CreateEntityForm worldId="w1" worldSlug="eldoria" />);

    await user.click(screen.getByTestId("create-entity-submit"));

    const nameInput = await screen.findByLabelText("Nom");
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAttribute("aria-describedby", "entity-name-error");
    expect(screen.getByText("Le nom est requis.")).toHaveAttribute("id", "entity-name-error");
  });
});
