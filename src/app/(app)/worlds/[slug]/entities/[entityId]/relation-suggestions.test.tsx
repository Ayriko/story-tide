import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { selectableRelationTypes } from "@/lib/relation-types";
import { RelationSuggestions } from "./relation-suggestions";

vi.mock("@/actions/declared-relations", () => ({
  createDeclaredRelationAction: vi.fn(),
  ignoreRelationSuggestionAction: vi.fn(),
  unignoreRelationSuggestionAction: vi.fn(),
}));

const OPTIONS = selectableRelationTypes({ custom: [], hidden: [] });
const CONTEXT = { worldId: "w1", worldSlug: "eldoria", entityId: "e-selyne" };

function suggestions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `e${index}`,
    name: `Entrée ${index}`,
    preselected: null,
  }));
}

describe("RelationSuggestions (KAN-84)", () => {
  it("pre-selectionne le type propose et nomme chaque action", () => {
    render(
      <RelationSuggestions
        {...CONTEXT}
        suggestions={[{ id: "e-port", name: "Port-Brume", preselected: "located|source" }]}
        ignored={[]}
        options={OPTIONS}
      />,
    );

    expect(screen.getByText("cité dans le texte")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Type de relation avec Port-Brume" });
    expect(select).toHaveValue("located|source");
    expect(screen.getByRole("option", { name: "Situé dans" })).toHaveProperty("selected", true);
    expect(
      screen.getByRole("button", { name: "Ajouter la relation avec Port-Brume" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ignorer la suggestion Port-Brume" }),
    ).toBeInTheDocument();
  });

  it("sans pre-selection : « Choisir un type… »", () => {
    render(
      <RelationSuggestions
        {...CONTEXT}
        suggestions={[{ id: "e-mira", name: "Mira", preselected: null }]}
        ignored={[]}
        options={OPTIONS}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Type de relation avec Mira" })).toHaveValue("");
  });

  it("jusqu'a 5 suggestions : depliees", () => {
    const { container } = render(
      <RelationSuggestions
        {...CONTEXT}
        suggestions={suggestions(5)}
        ignored={[]}
        options={OPTIONS}
      />,
    );
    expect(container.querySelector("details")).toBeNull();
  });

  it("au-dela de 5 : repliees sous « N entrees citees sans relation »", () => {
    render(
      <RelationSuggestions
        {...CONTEXT}
        suggestions={suggestions(6)}
        ignored={[]}
        options={OPTIONS}
      />,
    );
    const summary = screen.getByText("6 entrées citées sans relation");
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.closest("details")).not.toHaveAttribute("open");
  });

  it("suggestions ignorees : repliees, avec « Ne plus ignorer »", () => {
    render(
      <RelationSuggestions
        {...CONTEXT}
        suggestions={[]}
        ignored={[{ id: "e-old", name: "Vieux Phare" }]}
        options={OPTIONS}
      />,
    );
    expect(screen.getByText("1 suggestion ignorée").tagName).toBe("SUMMARY");
    expect(
      screen.getByRole("button", { name: "Ne plus ignorer la suggestion Vieux Phare" }),
    ).toBeInTheDocument();
  });
});
