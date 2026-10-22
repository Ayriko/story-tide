import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomRelationTypeForm } from "./custom-relation-type-form";

vi.mock("@/actions/world-settings", () => ({
  createCustomRelationTypeAction: vi.fn(),
  updateCustomRelationTypeAction: vi.fn(),
}));

describe("CustomRelationTypeForm (KAN-84)", () => {
  it("dirige par defaut : le libelle inverse est demande", () => {
    render(<CustomRelationTypeForm worldId="w1" onSaved={() => {}} />);
    expect(screen.getByRole("radio", { name: /Dirigée/ })).toBeChecked();
    expect(screen.getByLabelText("Libellé inverse")).toBeInTheDocument();
  });

  it("symetrique : le champ inverse disparait (jamais poste)", async () => {
    const user = userEvent.setup();
    render(<CustomRelationTypeForm worldId="w1" onSaved={() => {}} />);

    await user.click(screen.getByRole("radio", { name: /Symétrique/ }));

    expect(screen.queryByLabelText("Libellé inverse")).not.toBeInTheDocument();
  });

  it("modification d'un symetrique : pre-rempli, sans champ inverse", () => {
    render(
      <CustomRelationTypeForm
        worldId="w1"
        initial={{ id: "rt1", label: "Pacte", inverseLabel: null, symmetric: true }}
        onSaved={() => {}}
      />,
    );
    expect(screen.getByLabelText("Libellé")).toHaveValue("Pacte");
    expect(screen.getByRole("radio", { name: /Symétrique/ })).toBeChecked();
    expect(screen.queryByLabelText("Libellé inverse")).not.toBeInTheDocument();
  });
});
