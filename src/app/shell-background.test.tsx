import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShellBackground } from "./shell-background";

describe("ShellBackground", () => {
  it("ne porte aucun contenu accessible (purement decoratif)", () => {
    render(<ShellBackground />);

    // aria-hidden retire les deux calques de l'arbre d'accessibilite - un
    // lecteur d'ecran ne doit rien y trouver a annoncer.
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(document.body).toHaveTextContent("");
  });

  it("marque ses deux calques (image de fond + voile) aria-hidden", () => {
    const { container } = render(<ShellBackground />);

    const hiddenLayers = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenLayers).toHaveLength(2);
  });
});
