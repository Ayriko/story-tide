import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { deleteCustomTypeAction } from "@/actions/world-settings";
import { DeleteCustomTypeDialog } from "./delete-custom-type-dialog";

vi.mock("@/actions/world-settings", () => ({
  deleteCustomTypeAction: vi.fn(),
}));

const mockedDeleteCustomTypeAction = vi.mocked(deleteCustomTypeAction);

const SHIP = { id: "ct-ship", label: "Vaisseau", group: "Objets", icon: "ship" };
const BAG = { id: "ct-bag", label: "Besace", group: "Objets", icon: "package" };
const ENTRIES = [
  { id: "e1", name: "Aube Grise" },
  { id: "e2", name: "Brise-Lame" },
];

async function openDialog(entries = ENTRIES) {
  const user = userEvent.setup();
  render(
    <DeleteCustomTypeDialog
      worldId="w1"
      customType={SHIP}
      entries={entries}
      otherCustomTypes={[BAG]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Supprimer le type Vaisseau" }));
  return { user, dialog: screen.getByRole("dialog") };
}

beforeEach(() => {
  mockedDeleteCustomTypeAction.mockReset();
});

describe("DeleteCustomTypeDialog (KAN-81)", () => {
  it("sans entree : confirmation simple, bouton actif", async () => {
    const { dialog } = await openDialog([]);

    expect(within(dialog).getByText("Aucune entrée n'utilise ce type.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Supprimer le type" })).toBeEnabled();
  });

  it("bouton desactive tant qu'une entree n'a pas de cible", async () => {
    const { user, dialog } = await openDialog();
    const confirm = within(dialog).getByRole("button", { name: "Supprimer le type" });

    expect(confirm).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("Aube Grise"), "object");
    expect(confirm).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("Brise-Lame"), "custom:ct-bag");
    expect(confirm).toBeEnabled();
  });

  it("le choix global pre-remplit chaque entree, qui reste modifiable", async () => {
    const { user, dialog } = await openDialog();

    await user.selectOptions(
      within(dialog).getByLabelText("Réaffecter toutes ces entrées à…"),
      "object",
    );
    expect(within(dialog).getByLabelText("Aube Grise")).toHaveValue("object");
    expect(within(dialog).getByLabelText("Brise-Lame")).toHaveValue("object");

    await user.selectOptions(within(dialog).getByLabelText("Brise-Lame"), "custom:ct-bag");
    expect(within(dialog).getByLabelText("Aube Grise")).toHaveValue("object");
    expect(within(dialog).getByLabelText("Brise-Lame")).toHaveValue("custom:ct-bag");
    expect(within(dialog).getByRole("button", { name: "Supprimer le type" })).toBeEnabled();
  });

  it("propose les natifs masques compris et les autres types perso, jamais le type supprime", async () => {
    const { dialog } = await openDialog();
    const select = within(dialog).getByLabelText("Aube Grise");

    expect(within(select).getByRole("option", { name: "Prophétie" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Besace (perso)" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: /Vaisseau/ })).not.toBeInTheDocument();
  });

  it("soumet la carte reassign:<entityId> et affiche le refus du serveur", async () => {
    mockedDeleteCustomTypeAction.mockResolvedValueOnce({
      formError: "La liste a changé, recharge la page.",
    });
    const { user, dialog } = await openDialog();

    await user.selectOptions(
      within(dialog).getByLabelText("Réaffecter toutes ces entrées à…"),
      "object",
    );
    await user.click(within(dialog).getByRole("button", { name: "Supprimer le type" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "La liste a changé, recharge la page.",
    );
    const submitted = mockedDeleteCustomTypeAction.mock.calls[0]?.[1];
    expect(submitted?.get("typeId")).toBe("ct-ship");
    expect(submitted?.get("reassign:e1")).toBe("object");
    expect(submitted?.get("reassign:e2")).toBe("object");
  });
});
