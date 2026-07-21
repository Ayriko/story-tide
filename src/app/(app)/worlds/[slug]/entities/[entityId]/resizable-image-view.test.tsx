import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNodeViewProps } from "@tiptap/react";
import { ResizableImageView } from "./resizable-image-view";

// node.attrs/updateAttributes/selected/ref sont les seuls champs reellement
// lus par ResizableImageView (le reste de la forme ReactNodeViewProps - view,
// getPos, editor... - n'est jamais touche) - objet minimal + cast, meme
// convention que mention-list.test.tsx/auth-session.test.ts.
function fakeProps(overrides: {
  width?: number;
  selected: boolean;
  updateAttributes: (attrs: Record<string, unknown>) => void;
}): ReactNodeViewProps {
  return {
    node: { attrs: { src: "https://example.com/x.png", alt: "desc", width: overrides.width } },
    updateAttributes: overrides.updateAttributes,
    selected: overrides.selected,
    ref: createRef<HTMLElement>(),
  } as unknown as ReactNodeViewProps;
}

describe("ResizableImageView", () => {
  it("affiche l'image mais aucune poignee quand le noeud n'est pas selectionne", () => {
    render(
      <ResizableImageView
        {...fakeProps({ width: 50, selected: false, updateAttributes: vi.fn() })}
      />,
    );

    expect(screen.getByRole("img", { name: "desc" })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("affiche la poignee de redimensionnement (role slider) quand le noeud est selectionne", () => {
    render(
      <ResizableImageView
        {...fakeProps({ width: 50, selected: true, updateAttributes: vi.fn() })}
      />,
    );

    const handle = screen.getByRole("slider", { name: "Largeur de l'image" });
    expect(handle).toHaveAttribute("aria-valuenow", "50");
    expect(handle).toHaveAttribute("aria-valuemin", "10");
    expect(handle).toHaveAttribute("aria-valuemax", "100");
  });

  it("commit un pas de +5 via la fleche droite au clavier", async () => {
    const updateAttributes = vi.fn();
    const user = userEvent.setup();
    render(<ResizableImageView {...fakeProps({ width: 50, selected: true, updateAttributes })} />);

    screen.getByRole("slider").focus();
    await user.keyboard("{ArrowRight}");

    expect(updateAttributes).toHaveBeenCalledWith({ width: 55 });
  });

  it("borne le pas clavier a la limite haute (100)", async () => {
    const updateAttributes = vi.fn();
    const user = userEvent.setup();
    render(<ResizableImageView {...fakeProps({ width: 98, selected: true, updateAttributes })} />);

    screen.getByRole("slider").focus();
    await user.keyboard("{ArrowRight}");

    expect(updateAttributes).toHaveBeenCalledWith({ width: 100 });
  });

  it("borne le pas clavier a la limite basse (10)", async () => {
    const updateAttributes = vi.fn();
    const user = userEvent.setup();
    render(<ResizableImageView {...fakeProps({ width: 12, selected: true, updateAttributes })} />);

    screen.getByRole("slider").focus();
    await user.keyboard("{ArrowLeft}");

    expect(updateAttributes).toHaveBeenCalledWith({ width: 10 });
  });
});
