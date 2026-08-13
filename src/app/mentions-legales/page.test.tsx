import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MentionsLegalesPage from "./page";

describe("MentionsLegalesPage", () => {
  it("rend un titre h1 unique", () => {
    render(<MentionsLegalesPage />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Mentions légales");
  });

  it("mentionne l'hebergeur OVHcloud et son adresse", () => {
    render(<MentionsLegalesPage />);

    expect(screen.getByText(/OVHcloud/)).toBeInTheDocument();
    expect(screen.getByText(/59100 Roubaix/)).toBeInTheDocument();
  });

  it("expose au moins un lien mailto vers le contact beta", () => {
    render(<MentionsLegalesPage />);

    const contactLinks = screen.getAllByRole("link", { name: "contact@storytide.fr" });
    expect(contactLinks.length).toBeGreaterThan(0);
    for (const link of contactLinks) {
      expect(link).toHaveAttribute("href", "mailto:contact@storytide.fr");
    }
  });

  it("rend le footer partage (landmark contentinfo)", () => {
    render(<MentionsLegalesPage />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("rend les liens et le bouton de defilement atteignables au clavier dans l'ordre du DOM", async () => {
    const user = userEvent.setup();
    render(<MentionsLegalesPage />);

    // ScrollHint (bouton) s'intercale desormais entre les liens de <main> et
    // ceux du footer - on fusionne les deux roles et on trie par position
    // reelle dans le DOM plutot que de supposer un ordre.
    const interactive = [...screen.getAllByRole("link"), ...screen.getAllByRole("button")].sort(
      (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1),
    );
    for (const element of interactive) {
      await user.tab();
      expect(document.activeElement).toBe(element);
    }
  });
});
