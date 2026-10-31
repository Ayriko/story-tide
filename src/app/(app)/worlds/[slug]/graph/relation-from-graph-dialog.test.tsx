import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDeclaredRelationAction } from "@/actions/declared-relations";
import { RelationFromGraphDialog, type LinkEndpoint } from "./relation-from-graph-dialog";

vi.mock("@/actions/declared-relations", () => ({
  createDeclaredRelationAction: vi.fn(),
}));

const mockedCreate = vi.mocked(createDeclaredRelationAction);

const CATALOG = { custom: [], hidden: [] };
const SELYNE: LinkEndpoint = {
  id: "e-selyne",
  name: "Selyne",
  key: "character",
  group: "Personnages",
};
const ALDRIC: LinkEndpoint = {
  id: "e-aldric",
  name: "Aldric",
  key: "character",
  group: "Personnages",
};
const PORT: LinkEndpoint = { id: "e-port", name: "Port-Brume", key: "port", group: "Lieux" };

function sentFields(): Record<string, string> {
  const formData = mockedCreate.mock.calls[0]?.[1];
  if (!formData) {
    throw new Error("action jamais appelee");
  }
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)]));
}

function renderDialog(a: LinkEndpoint, b: LinkEndpoint) {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <RelationFromGraphDialog
      worldId="w1"
      worldSlug="eldoria"
      catalog={CATALOG}
      a={a}
      b={b}
      onClose={onClose}
      onCreated={onCreated}
    />,
  );
  return { onClose, onCreated };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("RelationFromGraphDialog (KAN-87)", () => {
  it("geste Selyne -> Aldric, « Parent de » sens Aldric -> Selyne : Selyne est la cible", async () => {
    const user = userEvent.setup();
    mockedCreate.mockResolvedValue({ ok: true });
    const { onCreated } = renderDialog(SELYNE, ALDRIC);

    // Personnage - personnage : aucune pre-selection, pas encore de sens.
    expect(screen.queryByRole("group", { name: "Sens" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Type de relation"), "parent|source");
    expect(screen.getByRole("radio", { name: "Selyne — Parent de → Aldric" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Aldric — Parent de → Selyne" }));
    await user.click(screen.getByRole("button", { name: "Créer" }));

    expect(sentFields()).toEqual({
      worldId: "w1",
      worldSlug: "eldoria",
      entityId: "e-selyne",
      otherId: "e-aldric",
      choice: "parent|target",
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("sens par defaut A -> B : Selyne est la source", async () => {
    const user = userEvent.setup();
    mockedCreate.mockResolvedValue({ ok: true });
    renderDialog(SELYNE, ALDRIC);

    await user.selectOptions(screen.getByLabelText("Type de relation"), "mentor|source");
    await user.click(screen.getByRole("button", { name: "Créer" }));

    expect(sentFields().choice).toBe("mentor|source");
  });

  it("pre-selection trouvee dans l'autre orientation : type et sens pre-remplis", () => {
    // Geste du lieu vers le personnage : « Situe dans », Selyne -> Port-Brume.
    renderDialog(PORT, SELYNE);

    expect(screen.getByLabelText("Type de relation")).toHaveValue("located|source");
    expect(screen.getByRole("radio", { name: "Selyne — Situé dans → Port-Brume" })).toBeChecked();
  });

  it("type symetrique : aucun choix de sens, point de vue « source »", async () => {
    const user = userEvent.setup();
    mockedCreate.mockResolvedValue({ ok: true });
    renderDialog(SELYNE, ALDRIC);

    await user.selectOptions(screen.getByLabelText("Type de relation"), "family|source");
    expect(screen.queryByRole("group", { name: "Sens" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Créer" }));

    expect(sentFields().choice).toBe("family|source");
  });

  it("une seule option par type dirige (pas de doublon « Enfant de »)", () => {
    renderDialog(SELYNE, ALDRIC);

    expect(screen.getByRole("option", { name: "Parent de" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Enfant de" })).not.toBeInTheDocument();
  });

  it("doublon : message dans la boite, choix conserves, rien de signale comme cree", async () => {
    const user = userEvent.setup();
    mockedCreate.mockResolvedValue({ formError: "Cette relation existe déjà." });
    const { onCreated } = renderDialog(SELYNE, ALDRIC);

    await user.selectOptions(screen.getByLabelText("Type de relation"), "parent|source");
    await user.click(screen.getByRole("radio", { name: "Aldric — Parent de → Selyne" }));
    await user.click(screen.getByRole("button", { name: "Créer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cette relation existe déjà.");
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Type de relation")).toHaveValue("parent|source");
    expect(screen.getByRole("radio", { name: "Aldric — Parent de → Selyne" })).toBeChecked();
  });

  it("Annuler : onClose, aucune action", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog(SELYNE, ALDRIC);

    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onClose).toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("Echap : onClose, aucune action", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog(SELYNE, ALDRIC);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});
