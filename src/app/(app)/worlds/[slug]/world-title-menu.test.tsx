import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorldTitleMenu } from "./world-title-menu";

describe("WorldTitleMenu (KAN-81)", () => {
  it("le titre reste un titre ; seul le chevron est un bouton de menu", () => {
    render(<WorldTitleMenu worldName="Eldoria" worldSlug="eldoria" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/^Eldoria$/);
    expect(within(heading).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Menu du monde" })).toHaveAttribute(
      "aria-haspopup",
      "menu",
    );
  });

  it("ouvre au clavier un menu vers les parametres et les types d'entrees", async () => {
    const user = userEvent.setup();
    render(<WorldTitleMenu worldName="Eldoria" worldSlug="eldoria" />);

    screen.getByRole("button", { name: "Menu du monde" }).focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("menuitem", { name: "Paramètres du monde" })).toHaveAttribute(
      "href",
      "/worlds/eldoria/settings",
    );
    expect(screen.getByRole("menuitem", { name: "Types d'entrées" })).toHaveAttribute(
      "href",
      "/worlds/eldoria/settings/types",
    );
  });
});

describe("WorldTitleMenu - total et legende du ciel (KAN-85)", () => {
  it("sous le titre, le seul total, accorde", () => {
    const { rerender } = render(
      <WorldTitleMenu worldName="Eldoria" worldSlug="eldoria" total={300} />,
    );
    expect(screen.getByText("300 entrées")).toBeInTheDocument();
    rerender(<WorldTitleMenu worldName="Eldoria" worldSlug="eldoria" total={1} />);
    expect(screen.getByText("1 entrée")).toBeInTheDocument();
    rerender(<WorldTitleMenu worldName="Eldoria" worldSlug="eldoria" total={0} />);
    expect(screen.queryByText(/entrée/)).not.toBeInTheDocument();
  });

  it("panneau : legende en liste (pastille, icone, nom, nombre) hors du role menu", async () => {
    const user = userEvent.setup();
    render(
      <WorldTitleMenu
        worldName="Eldoria"
        worldSlug="eldoria"
        total={5}
        legend={[
          { group: "Personnages", count: 3 },
          { group: "Lieux", count: 2 },
        ]}
      />,
    );

    screen.getByRole("button", { name: "Menu du monde" }).focus();
    await user.keyboard("{Enter}");

    const list = await screen.findByRole("list", { name: "Légende du ciel" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Personnages3", "Lieux2"]);
    // Pastille : meme jeton que les etoiles du ciel ; jamais seule (nom lu).
    const swatch = items[0]?.querySelector("span[aria-hidden='true']");
    expect(swatch).toHaveStyle({ backgroundColor: "var(--sky-star-personnages)" });
    // ARIA strict : la liste n'est pas dans le menu, qui ne contient que les
    // deux actions ; elle le precede dans le meme panneau.
    const menu = screen.getByRole("menu", { name: "Menu du monde" });
    expect(menu).not.toContainElement(list);
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(2);
    expect(list.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });

  it("les fleches parcourent toujours les actions du menu", async () => {
    const user = userEvent.setup();
    render(
      <WorldTitleMenu
        worldName="Eldoria"
        worldSlug="eldoria"
        total={3}
        legend={[{ group: "Personnages", count: 3 }]}
      />,
    );
    screen.getByRole("button", { name: "Menu du monde" }).focus();
    await user.keyboard("{Enter}");
    const settings = await screen.findByRole("menuitem", { name: "Paramètres du monde" });
    expect(settings).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Types d'entrées" })).toHaveFocus();
  });

  it("monde vide : pas de legende", async () => {
    const user = userEvent.setup();
    render(<WorldTitleMenu worldName="Eldoria" worldSlug="eldoria" />);
    screen.getByRole("button", { name: "Menu du monde" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    expect(screen.queryByRole("list", { name: "Légende du ciel" })).not.toBeInTheDocument();
  });
});
