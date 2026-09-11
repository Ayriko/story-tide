import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderTree } from "./folder-tree";
import { buildTreeNodes, type TreeNode } from "./folder-tree-utils";
import type { FolderTreeNode } from "@/services/folder-service";

function makeFolderNode(overrides: Partial<FolderTreeNode> = {}): FolderTreeNode {
  return {
    id: "f1",
    worldId: "w1",
    name: "Dossier",
    parentId: null,
    seedRef: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    children: [],
    ...overrides,
  };
}

// Royaumes (dossier, 1 enfant) > Nord (dossier, 1 enfant) > Capitales
// (dossier, vide) ; Non classé (1 entite) - assez pour exercer les 4
// touches fleche + Home/End sur 3 niveaux de profondeur sans fixture
// disproportionnee.
function buildFixtureTree(): TreeNode[] {
  return buildTreeNodes(
    [
      makeFolderNode({
        id: "f1",
        name: "Royaumes",
        children: [
          makeFolderNode({
            id: "f2",
            name: "Nord",
            parentId: "f1",
            children: [
              makeFolderNode({ id: "f3", name: "Capitales", parentId: "f2", children: [] }),
            ],
          }),
        ],
      }),
    ],
    [{ id: "e1", name: "Aeliana", type: "character" }],
  );
}

describe("FolderTree", () => {
  it("expose un role=tree nomme, avec un treeitem par noeud racine", () => {
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    expect(screen.getByRole("tree", { name: "Dossiers" })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /Royaumes/ })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /Non classé/ })).toBeInTheDocument();
  });

  it("« Non classé » est pliable et contient les entites sans dossier une fois deplie", async () => {
    const user = userEvent.setup();
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    const unfiled = screen.getByRole("treeitem", { name: /Non classé/ });
    expect(unfiled).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /Aeliana/ })).not.toBeInTheDocument();

    await user.click(unfiled);

    expect(unfiled).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("treeitem", { name: /Aeliana/ })).toBeInTheDocument();
  });

  it("un dossier vide n'a pas aria-expanded (rien a plier)", async () => {
    const user = userEvent.setup();
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    await user.click(screen.getByRole("treeitem", { name: /Royaumes/ }));
    await user.click(screen.getByRole("treeitem", { name: "Nord" }));

    expect(screen.getByRole("treeitem", { name: "Capitales" })).not.toHaveAttribute(
      "aria-expanded",
    );
  });

  it("ArrowDown deplace le focus au noeud visible suivant", async () => {
    const user = userEvent.setup();
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    const royaumes = screen.getByRole("treeitem", { name: /Royaumes/ });
    royaumes.focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("treeitem", { name: /Non classé/ })).toHaveFocus();
  });

  it("ArrowRight deplie un dossier ferme (premiere pression) puis descend (deuxieme pression)", async () => {
    const user = userEvent.setup();
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    const royaumes = screen.getByRole("treeitem", { name: /Royaumes/ });
    royaumes.focus();

    await user.keyboard("{ArrowRight}");
    expect(royaumes).toHaveAttribute("aria-expanded", "true");
    expect(royaumes).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("treeitem", { name: "Nord" })).toHaveFocus();
  });

  it("ArrowRight est un no-op sur une feuille (entite)", async () => {
    const user = userEvent.setup();
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    await user.click(screen.getByRole("treeitem", { name: /Non classé/ }));
    const aeliana = screen.getByRole("treeitem", { name: /Aeliana/ });
    aeliana.focus();

    await user.keyboard("{ArrowRight}");

    expect(aeliana).toHaveFocus();
  });

  it("ArrowLeft replie un dossier deplie, puis une seconde pression remonte au parent", async () => {
    const user = userEvent.setup();
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    const royaumes = screen.getByRole("treeitem", { name: /Royaumes/ });
    royaumes.focus();
    // Deplie Royaumes, descend sur Nord, deplie Nord (Nord a un enfant,
    // "Capitales" - le focus reste sur Nord apres cette 3e pression).
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    const nord = screen.getByRole("treeitem", { name: "Nord" });
    expect(nord).toHaveFocus();
    expect(nord).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowLeft}");
    expect(nord).toHaveFocus();
    expect(nord).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{ArrowLeft}");
    expect(royaumes).toHaveFocus();
  });

  it("Home/End vont au premier et au dernier noeud VISIBLE (pas le plus profond)", async () => {
    const user = userEvent.setup();
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    const royaumes = screen.getByRole("treeitem", { name: /Royaumes/ });
    royaumes.focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("treeitem", { name: /Non classé/ })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(royaumes).toHaveFocus();
  });

  it("exactement un treeitem porte tabIndex=0 a chaque etape d'une sequence de navigation", async () => {
    const user = userEvent.setup();
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    function assertSingleTabbable() {
      const items = screen.getAllByRole("treeitem");
      const tabbable = items.filter((item) => item.getAttribute("tabindex") === "0");
      expect(tabbable).toHaveLength(1);
    }

    assertSingleTabbable();
    screen.getByRole("treeitem", { name: /Royaumes/ }).focus();
    assertSingleTabbable();

    await user.keyboard("{ArrowRight}");
    assertSingleTabbable();

    await user.keyboard("{ArrowRight}");
    assertSingleTabbable();
  });

  it("une entite sans dossier est un lien atteignable au clavier vers sa fiche", async () => {
    const user = userEvent.setup();
    render(<FolderTree tree={buildFixtureTree()} worldSlug="eldoria" />);

    await user.click(screen.getByRole("treeitem", { name: /Non classé/ }));
    const link = within(screen.getByRole("tree")).getByRole("treeitem", { name: /Aeliana/ });

    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/worlds/eldoria/entities/e1");
  });
});
