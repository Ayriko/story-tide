import { describe, expect, it } from "vitest";
import { RelationOrigin } from "@/generated/prisma/client";
import { buildGraphElements } from "./graph-elements";

describe("buildGraphElements", () => {
  it("retourne des tableaux vides sans entite ni relation", () => {
    expect(buildGraphElements([], [])).toEqual({ nodes: [], edges: [] });
  });

  it("convertit chaque entite en node avec id/label/type", () => {
    const result = buildGraphElements(
      [
        { id: "e1", name: "Aeliana", type: "character" },
        { id: "e2", name: "Valombre", type: "place" },
      ],
      [],
    );

    expect(result.nodes).toEqual([
      { data: { id: "e1", label: "Aeliana", type: "character" } },
      { data: { id: "e2", label: "Valombre", type: "place" } },
    ]);
  });

  it("convertit chaque relation en arete avec source/target/origin", () => {
    const result = buildGraphElements(
      [
        { id: "e1", name: "Aeliana", type: "character" },
        { id: "e2", name: "Valombre", type: "place" },
      ],
      [{ sourceId: "e1", targetId: "e2", origin: RelationOrigin.AUTO }],
    );

    expect(result.edges).toEqual([
      {
        data: { id: "e1->e2:AUTO", source: "e1", target: "e2", origin: RelationOrigin.AUTO },
      },
    ]);
  });

  it("distingue une arete AUTO et une arete MANUAL pour le meme couple (id different)", () => {
    const result = buildGraphElements(
      [
        { id: "e1", name: "Aeliana", type: "character" },
        { id: "e2", name: "Valombre", type: "place" },
      ],
      [
        { sourceId: "e1", targetId: "e2", origin: RelationOrigin.AUTO },
        { sourceId: "e1", targetId: "e2", origin: RelationOrigin.MANUAL },
      ],
    );

    expect(result.edges).toHaveLength(2);
    expect(result.edges.map((edge) => edge.data.id)).toEqual(["e1->e2:AUTO", "e1->e2:MANUAL"]);
  });

  it("omet silencieusement une arete dont une extremite n'est plus dans la liste d'entites", () => {
    const result = buildGraphElements(
      [{ id: "e1", name: "Aeliana", type: "character" }],
      [{ sourceId: "e1", targetId: "e2-supprime", origin: RelationOrigin.AUTO }],
    );

    expect(result.edges).toEqual([]);
  });
});
