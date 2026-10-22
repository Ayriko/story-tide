import { describe, expect, it } from "vitest";
import { resolveEntityType, type WorldTypeCatalog } from "./entity-types";
import { suggestRelationChoice } from "./relation-suggestions";
import type { WorldRelationTypeCatalog } from "./relation-types";

const ENTITY_CATALOG: WorldTypeCatalog = {
  custom: [{ id: "ct-ship", label: "Vaisseau", group: "Objets", icon: "ship" }],
  hidden: [],
};
const RELATIONS: WorldRelationTypeCatalog = { custom: [], hidden: [] };

function typed(type: string, customTypeId: string | null = null) {
  return resolveEntityType({ type, customTypeId }, ENTITY_CATALOG);
}

describe("suggestRelationChoice", () => {
  it("Personnages -> Lieux : Situe dans", () => {
    expect(suggestRelationChoice(typed("character"), typed("place"), RELATIONS)).toEqual({
      key: "located",
      viewpoint: "source",
    });
  });

  it("Personnages -> Organisation : Membre de", () => {
    expect(suggestRelationChoice(typed("character"), typed("faction"), RELATIONS)).toEqual({
      key: "member",
      viewpoint: "source",
    });
  });

  it("Personnages -> Lore : Venere seulement pour une divinite", () => {
    expect(suggestRelationChoice(typed("character"), typed("deity"), RELATIONS)).toEqual({
      key: "worships",
      viewpoint: "source",
    });
    expect(suggestRelationChoice(typed("character"), typed("prophecy"), RELATIONS)).toBeNull();
  });

  it("Objets -> Personnages : Possede LU DEPUIS LA CIBLE (relation personne -owns-> objet)", () => {
    // Depuis la fiche de l'objet, l'option est « Appartient a » : point de
    // vue « target » = l'objet est la cible de la relation creee.
    expect(suggestRelationChoice(typed("object"), typed("character"), RELATIONS)).toEqual({
      key: "owns",
      viewpoint: "target",
    });
  });

  it("Lieux -> Lieux : Situe dans", () => {
    expect(suggestRelationChoice(typed("place"), typed("place"), RELATIONS)).toEqual({
      key: "located",
      viewpoint: "source",
    });
  });

  it("Personnages -> Personnages et le reste : aucune pre-selection", () => {
    expect(suggestRelationChoice(typed("character"), typed("character"), RELATIONS)).toBeNull();
    expect(suggestRelationChoice(typed("place"), typed("character"), RELATIONS)).toBeNull();
  });

  it("un type perso compte comme son groupe (Vaisseau, Objets -> Personnages)", () => {
    expect(
      suggestRelationChoice(typed("custom", "ct-ship"), typed("character"), RELATIONS),
    ).toEqual({ key: "owns", viewpoint: "target" });
  });

  it("type pre-selectionne masque dans le monde : non propose", () => {
    expect(
      suggestRelationChoice(typed("character"), typed("place"), {
        custom: [],
        hidden: ["located"],
      }),
    ).toBeNull();
  });
});
