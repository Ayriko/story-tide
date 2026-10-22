import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { deleteCustomRelationTypeAction } from "@/actions/world-settings";
import type { WorldRelationTypeCatalog } from "@/lib/relation-types";
import { DeleteCustomRelationTypeDialog } from "./delete-custom-relation-type-dialog";

vi.mock("@/actions/world-settings", () => ({
  deleteCustomRelationTypeAction: vi.fn(),
}));

const mockedAction = vi.mocked(deleteCustomRelationTypeAction);

const SUZERAIN = {
  id: "rt-suz",
  label: "Suzerain de",
  inverseLabel: "Vassal de",
  symmetric: false,
};
const GARDIEN = { id: "rt-gar", label: "Gardien de", inverseLabel: "Gardé par", symmetric: false };
const PACTE = { id: "rt-pac", label: "Pacte", inverseLabel: null, symmetric: true };
const CATALOG: WorldRelationTypeCatalog = { custom: [SUZERAIN, GARDIEN, PACTE], hidden: ["owns"] };
const USAGES = [
  { id: "r1", sourceName: "Selyne", targetName: "Aldric", existingTypeKeys: ["leads"] },
  { id: "r2", sourceName: "Selyne", targetName: "Mira", existingTypeKeys: [] },
];

async function openDialog(usages = USAGES) {
  const user = userEvent.setup();
  render(
    <DeleteCustomRelationTypeDialog
      worldId="w1"
      customType={SUZERAIN}
      usages={usages}
      catalog={CATALOG}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Supprimer le type Suzerain de" }));
  return { user, dialog: screen.getByRole("dialog") };
}

function optionValues(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.getAttribute("value"));
}

beforeEach(() => {
  mockedAction.mockReset();
});

describe("DeleteCustomRelationTypeDialog (KAN-84)", () => {
  it("sans relation : confirmation simple, bouton actif", async () => {
    const { dialog } = await openDialog([]);
    expect(within(dialog).getByText("Aucune relation n'utilise ce type.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Supprimer le type" })).toBeEnabled();
  });

  it("ne propose que des cibles de meme nature (dirigees), natifs masques compris, jamais lui-meme", async () => {
    const { dialog } = await openDialog();
    const values = optionValues(within(dialog).getByLabelText("Selyne — Suzerain de → Aldric"));

    expect(values).toContain("leads");
    expect(values).toContain("owns");
    expect(values).toContain("custom:rt-gar");
    expect(values).not.toContain("ally");
    expect(values).not.toContain("custom:rt-pac");
    expect(values).not.toContain("custom:rt-suz");
  });

  it("annonce avant validation qu'une relation deja presente sera supprimee", async () => {
    const { user, dialog } = await openDialog();
    const confirm = within(dialog).getByRole("button", { name: "Supprimer le type" });
    expect(confirm).toBeDisabled();

    await user.selectOptions(
      within(dialog).getByLabelText("Réaffecter toutes ces relations à…"),
      "leads",
    );

    expect(within(dialog).getByText("Déjà présente : sera supprimée.")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "1 relation existe déjà avec le type choisi : elle sera supprimée au lieu d'être dupliquée.",
      ),
    ).toBeInTheDocument();
    expect(confirm).toBeEnabled();
  });

  it("aucune annonce de doublon pour une cible absente de la paire", async () => {
    const { user, dialog } = await openDialog();
    await user.selectOptions(
      within(dialog).getByLabelText("Réaffecter toutes ces relations à…"),
      "custom:rt-gar",
    );
    expect(within(dialog).queryByText("Déjà présente : sera supprimée.")).not.toBeInTheDocument();
  });
});
