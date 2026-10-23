import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { resolveRelationType } from "@/lib/relation-types";
import type { DeclaredRelationView } from "@/services/declared-relation-service";
import { DeclaredRelations } from "./declared-relations";

vi.mock("@/actions/declared-relations", () => ({
  deleteDeclaredRelationAction: vi.fn(),
}));

const PARENT = resolveRelationType(
  { relationType: "parent", customRelationTypeId: null },
  { custom: [], hidden: [] },
);

function view(id: string, name: string, viewpoint: "source" | "target"): DeclaredRelationView {
  return {
    id,
    other: { id: `e-${id}`, name },
    relationType: PARENT,
    viewpoint,
    label: viewpoint === "source" ? "Parent de" : "Enfant de",
  };
}

describe("DeclaredRelations (KAN-84)", () => {
  it("vide : message", () => {
    render(<DeclaredRelations worldId="w1" worldSlug="eldoria" relations={[]} />);
    expect(screen.getByText("Aucune relation déclarée pour l'instant.")).toBeInTheDocument();
  });

  it("groupe par libelle lu depuis la fiche, lien vers chaque entree", () => {
    render(
      <DeclaredRelations
        worldId="w1"
        worldSlug="eldoria"
        relations={[
          view("r1", "Aldric", "source"),
          view("r2", "Mira", "source"),
          view("r3", "Orin", "target"),
        ]}
      />,
    );

    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["Parent de", "Enfant de"]);
    const parentGroup = screen.getByText("Parent de").parentElement;
    expect(parentGroup).not.toBeNull();
    expect(
      within(parentGroup as HTMLElement)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Aldric", "Mira"]);
    expect(screen.getByRole("link", { name: "Orin" })).toHaveAttribute(
      "href",
      "/worlds/eldoria/entities/e-r3",
    );
  });

  it("bouton de suppression au nom complet, distinct par relation", () => {
    render(
      <DeclaredRelations
        worldId="w1"
        worldSlug="eldoria"
        relations={[view("r1", "Aldric", "source"), view("r3", "Orin", "target")]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Supprimer la relation Parent de Aldric" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Supprimer la relation Enfant de Orin" }),
    ).toBeInTheDocument();
  });
});
