import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FOOTER_ID } from "./footer";
import { ScrollHint } from "./scroll-hint";

// ScrollHint repere son conteneur via closest("[data-scroll-container]") et
// le pied de page via document.getElementById(FOOTER_ID) - meme structure
// que les vrais call-sites (worlds/page.tsx, world-shell.tsx, etc.).
function renderInScrollContainer() {
  return render(
    <div data-scroll-container>
      <ScrollHint />
      <footer id={FOOTER_ID} />
    </div>,
  );
}

describe("ScrollHint", () => {
  it("la bande sticky laisse passer le pointeur, seul le bouton le capte (KAN-85)", () => {
    renderInScrollContainer();
    const button = screen.getByRole("button", { name: "Aller au pied de page" });
    // Non-regression : la bande pleine largeur recouvrait le bouton
    // « Reorganiser automatiquement » de la Constellation.
    expect(button.parentElement).toHaveClass("pointer-events-none");
    expect(button).toHaveClass("pointer-events-auto");
  });

  it("expose un bouton (pas un lien) avec un nom accessible explicite", () => {
    renderInScrollContainer();

    expect(screen.getByRole("button", { name: "Aller au pied de page" })).toBeInTheDocument();
  });

  it("fait defiler son conteneur au clic (IntersectionObserver polyfille en no-op : etat ferme)", async () => {
    const { container } = renderInScrollContainer();
    const scrollContainer = container.querySelector("[data-scroll-container]");
    // jsdom n'implemente pas Element.scrollTo - stub local a ce test.
    const scrollTo = vi.fn();
    Object.assign(scrollContainer as Element, { scrollTo });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Aller au pied de page" }));

    expect(scrollTo).toHaveBeenCalledWith({
      top: scrollContainer?.scrollHeight,
      behavior: "smooth",
    });
  });
});
