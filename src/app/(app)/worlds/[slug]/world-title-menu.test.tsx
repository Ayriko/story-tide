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
