import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createCustomTypeAction, updateCustomTypeAction } from "@/actions/world-settings";
import { CustomTypeForm } from "./custom-type-form";

vi.mock("@/actions/world-settings", () => ({
  createCustomTypeAction: vi.fn(),
  updateCustomTypeAction: vi.fn(),
}));

const mockedCreate = vi.mocked(createCustomTypeAction);
const mockedUpdate = vi.mocked(updateCustomTypeAction);

beforeEach(() => {
  mockedCreate.mockReset();
  mockedUpdate.mockReset();
});

describe("CustomTypeForm (KAN-81)", () => {
  it("labels natifs, icone par defaut = icone du groupe, qui suit le groupe", async () => {
    const user = userEvent.setup();
    render(<CustomTypeForm worldId="w1" onSaved={vi.fn()} />);

    expect(screen.getByLabelText("Libellé")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Icône" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Note" })).toBeChecked();

    await user.selectOptions(screen.getByLabelText("Groupe"), "Objets");
    expect(screen.getByRole("radio", { name: "Paquet" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Navire" }));
    await user.selectOptions(screen.getByLabelText("Groupe"), "Lieux");
    expect(screen.getByRole("radio", { name: "Navire" })).toBeChecked();
  });

  it("creation reussie : soumet libelle/groupe/icone et appelle onSaved", async () => {
    mockedCreate.mockResolvedValueOnce({ ok: true });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<CustomTypeForm worldId="w1" onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Libellé"), "Vaisseau");
    await user.selectOptions(screen.getByLabelText("Groupe"), "Objets");
    await user.click(screen.getByRole("radio", { name: "Navire" }));
    await user.click(screen.getByRole("button", { name: "Créer le type" }));

    // L'action est lancee par React dans une transition (asynchrone).
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const submitted = mockedCreate.mock.calls[0]?.[1];
    expect(submitted?.get("label")).toBe("Vaisseau");
    expect(submitted?.get("group")).toBe("Objets");
    expect(submitted?.get("icon")).toBe("ship");
  });

  it("erreur de libelle : reliee au champ, onSaved non appele", async () => {
    mockedCreate.mockResolvedValueOnce({
      errors: { label: "Ce libellé est déjà utilisé dans ce monde." },
      values: { label: "Personnage", group: "Divers", icon: "sticky-note" },
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<CustomTypeForm worldId="w1" onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Libellé"), "Personnage");
    await user.click(screen.getByRole("button", { name: "Créer le type" }));

    // Attendre le rendu de l'erreur elle-meme (le champ existe deja avant :
    // findByLabelText resoudrait trop tot sous charge).
    await screen.findByText("Ce libellé est déjà utilisé dans ce monde.");
    const input = screen.getByLabelText("Libellé");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Ce libellé est déjà utilisé dans ce monde.");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("modification : pre-remplit et appelle l'action de mise a jour avec typeId", async () => {
    mockedUpdate.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(
      <CustomTypeForm
        worldId="w1"
        initial={{ id: "ct-ship", label: "Vaisseau", group: "Objets", icon: "ship" }}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Libellé")).toHaveValue("Vaisseau");
    expect(screen.getByRole("radio", { name: "Navire" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(mockedUpdate.mock.calls[0]?.[1].get("typeId")).toBe("ct-ship");
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});
