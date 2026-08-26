import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArtistCredit } from "./artist-credit";

describe("ArtistCredit", () => {
  it("pointe vers le profil de l'artiste, ouvert dans un nouvel onglet securise", () => {
    render(<ArtistCredit />);

    const link = screen.getByRole("link", { name: /Dvkin/ });
    expect(link).toHaveAttribute("href", "https://vgen.co/dvkin");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("annonce l'ouverture d'une nouvelle fenetre dans le nom accessible", () => {
    render(<ArtistCredit />);

    expect(screen.getByRole("link", { name: /Dvkin.*nouvelle fenêtre/i })).toBeInTheDocument();
  });
});
