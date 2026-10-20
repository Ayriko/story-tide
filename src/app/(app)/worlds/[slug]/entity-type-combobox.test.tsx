import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderInWorld } from "@/test-utils/render-in-world";
import userEvent from "@testing-library/user-event";
import { EntityTypeCombobox } from "./entity-type-combobox";

function hiddenValue(container: HTMLElement): string | null {
  return container.querySelector<HTMLInputElement>('input[name="type"]')?.value ?? null;
}

describe("EntityTypeCombobox", () => {
  it("affiche le libelle du type par defaut, avec le vrai id soumis en input cache", () => {
    const { container } = renderInWorld(
      <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />,
    );

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("Personnage");
    expect(hiddenValue(container)).toBe("character");
  });

  it("ouvre la liste groupee au focus et filtre au fil de la frappe", async () => {
    const user = userEvent.setup();
    renderInWorld(
      <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />,
    );

    const input = screen.getByRole("combobox", { name: "Type" });
    await user.click(input);
    expect(screen.getByRole("listbox", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByText("Personnages")).toBeInTheDocument();
    expect(screen.getByText("Objets")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "arme");

    expect(screen.getByRole("option", { name: "Arme" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Personnage" })).not.toBeInTheDocument();
  });

  it("le clic sur une option la selectionne (texte affiche + input cache)", async () => {
    const user = userEvent.setup();
    const { container } = renderInWorld(
      <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />,
    );

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(screen.getByRole("option", { name: "Arme" }));

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("Arme");
    expect(hiddenValue(container)).toBe("weapon");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("affiche un etat vide quand aucun type ne correspond a la recherche", async () => {
    const user = userEvent.setup();
    renderInWorld(
      <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />,
    );

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.type(screen.getByRole("combobox", { name: "Type" }), "zzz-introuvable");

    expect(screen.getByText("Aucun type trouvé.")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("ArrowDown deplace la selection active, Enter valide", async () => {
    const user = userEvent.setup();
    const { container } = renderInWorld(
      <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />,
    );

    const input = screen.getByRole("combobox", { name: "Type" });
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    // Personnage (index 0) -> Faune (1) -> Flore (2) : 2 ArrowDown = Flore.
    expect(hiddenValue(container)).toBe("flora");
  });

  it("le dernier type du dernier groupe reste atteignable au clavier (non-regression : panneau rogne par un ancetre overflow-hidden)", async () => {
    const user = userEvent.setup();
    const { container } = renderInWorld(
      <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />,
    );

    const input = screen.getByRole("combobox", { name: "Type" });
    await user.click(input);
    // 26 types au total (ENTITY_TYPES, entity-schemas.ts) - 25 ArrowDown depuis
    // le premier (Personnage, index 0) atteint le dernier (Note, "Divers",
    // dernier groupe). Avant le passage sur Popover/PopoverContent (portail
    // Radix), le panneau etait un <div absolute> a l'interieur d'un
    // conteneur overflow-hidden (Card) qui le rognait a l'affichage bien
    // avant ce point.
    await user.keyboard("{ArrowDown}".repeat(25));
    expect(screen.getByRole("option", { name: "Note" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");
    expect(hiddenValue(container)).toBe("note");
  });

  it("Echap ferme la liste sans changer la selection", async () => {
    const user = userEvent.setup();
    const { container } = renderInWorld(
      <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />,
    );

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(hiddenValue(container)).toBe("character");
  });

  it("revient au libelle du dernier type valide si le texte tape ne correspond a rien, au blur", async () => {
    const user = userEvent.setup();
    renderInWorld(
      <div>
        <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />
        <button type="button">Ailleurs</button>
      </div>,
    );

    const input = screen.getByRole("combobox", { name: "Type" });
    await user.click(input);
    await user.type(input, "zzz-introuvable");
    await user.click(screen.getByRole("button", { name: "Ailleurs" }));

    expect(input).toHaveValue("Personnage");
  });

  // KAN-81 : types du monde (catalogue en contexte).
  describe("types du monde (KAN-81)", () => {
    const CATALOG = {
      custom: [{ id: "ct-ship", label: "Vaisseau", group: "Objets", icon: "ship" }],
      hidden: ["prophecy"],
    };

    it("propose un type personnalise dans son groupe, marque perso, et soumet custom + id", async () => {
      const user = userEvent.setup();
      const { container } = renderInWorld(
        <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />,
        { catalog: CATALOG },
      );

      await user.click(screen.getByRole("combobox", { name: "Type" }));
      await user.click(screen.getByRole("option", { name: "Vaisseau (type personnalisé)" }));

      expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("Vaisseau");
      expect(hiddenValue(container)).toBe("custom");
      expect(container.querySelector<HTMLInputElement>('input[name="customTypeId"]')?.value).toBe(
        "ct-ship",
      );
    });

    it("n'affiche pas un type natif masque", async () => {
      const user = userEvent.setup();
      renderInWorld(
        <EntityTypeCombobox id="entity-type" name="type" label="Type" defaultValue="character" />,
        { catalog: CATALOG },
      );

      await user.click(screen.getByRole("combobox", { name: "Type" }));
      expect(screen.queryByRole("option", { name: "Prophétie" })).not.toBeInTheDocument();
    });

    it("garde le type courant masque de l'entree modifiee (keepTypeKey)", async () => {
      const user = userEvent.setup();
      renderInWorld(
        <EntityTypeCombobox
          id="entity-type"
          name="type"
          label="Type"
          defaultValue="prophecy"
          keepTypeKey="prophecy"
        />,
        { catalog: CATALOG },
      );

      expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("Prophétie");
      await user.click(screen.getByRole("combobox", { name: "Type" }));
      expect(screen.getByRole("option", { name: "Prophétie" })).toBeInTheDocument();
    });
  });
});
