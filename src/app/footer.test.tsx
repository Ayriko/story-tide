import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./footer";

describe("Footer", () => {
  it("expose un landmark contentinfo", () => {
    render(<Footer />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("affiche la mention Tidemark Studio", () => {
    render(<Footer />);

    expect(screen.getByText(/Tidemark Studio/)).toBeInTheDocument();
  });

  it("pointe le lien mentions legales vers la page dediee", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "Mentions légales" })).toHaveAttribute(
      "href",
      "/mentions-legales",
    );
  });

  it("affiche l'adresse de contact beta en toutes lettres, pas un libellé qui la masque", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "contact@storytide.fr" })).toHaveAttribute(
      "href",
      "mailto:contact@storytide.fr",
    );
  });

  it("ouvre le statut du service dans un nouvel onglet avec rel securise", () => {
    render(<Footer />);

    const statusLink = screen.getByRole("link", { name: /statut du service/i });
    expect(statusLink).toHaveAttribute("href", "https://status.storytide.fr");
    expect(statusLink).toHaveAttribute("target", "_blank");
    expect(statusLink.getAttribute("rel")).toContain("noopener");
    expect(statusLink.getAttribute("rel")).toContain("noreferrer");
  });

  it("annonce l'ouverture d'une nouvelle fenetre dans le nom accessible du lien externe", () => {
    render(<Footer />);

    expect(
      screen.getByRole("link", { name: /statut du service.*nouvelle fenêtre/i }),
    ).toBeInTheDocument();
  });
});
