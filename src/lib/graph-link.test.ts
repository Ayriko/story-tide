import { describe, expect, it } from "vitest";
import {
  isSymmetricRelationType,
  linkFormFields,
  linkRelationTypeOptions,
  preselectRelation,
} from "./graph-link";
import type { WorldRelationTypeCatalog } from "./relation-types";

const CATALOG: WorldRelationTypeCatalog = { custom: [], hidden: [] };

const selyne = { id: "e-selyne", key: "character", group: "Personnages" };
const portBrume = { id: "e-port", key: "port", group: "Lieux" };
const epee = { id: "e-epee", key: "object", group: "Objets" };

describe("linkRelationTypeOptions", () => {
  it("une seule option par type dirige (son libelle), les symetriques inchangees", () => {
    const options = linkRelationTypeOptions(CATALOG);

    expect(options.directed.map((option) => option.label)).toContain("Parent de");
    expect(options.directed.map((option) => option.label)).not.toContain("Enfant de");
    expect(options.directed.every((option) => option.viewpoint === "source")).toBe(true);
    expect(options.symmetric.map((option) => option.label)).toContain("Famille");
  });

  it("type natif masque : absent", () => {
    const options = linkRelationTypeOptions({ custom: [], hidden: ["parent"] });

    expect(options.directed.map((option) => option.key)).not.toContain("parent");
  });
});

describe("isSymmetricRelationType", () => {
  it("symetrique, dirige, perso, inconnu", () => {
    expect(isSymmetricRelationType(CATALOG, "family")).toBe(true);
    expect(isSymmetricRelationType(CATALOG, "parent")).toBe(false);
    expect(
      isSymmetricRelationType(
        {
          custom: [{ id: "c1", label: "Suzerain de", inverseLabel: "Vassal de", symmetric: false }],
          hidden: [],
        },
        "custom:c1",
      ),
    ).toBe(false);
    expect(isSymmetricRelationType(CATALOG, "inconnu")).toBe(true);
  });
});

describe("preselectRelation", () => {
  it("A cite B selon la table (personnage -> lieu) : « Situe dans », A -> B", () => {
    expect(preselectRelation(selyne, portBrume, CATALOG)).toEqual({
      key: "located",
      direction: "a-to-b",
    });
  });

  it("regle trouvee seulement dans l'autre orientation : sens B -> A", () => {
    // lieu -> personnage : aucune regle ; personnage -> lieu : located, source.
    expect(preselectRelation(portBrume, selyne, CATALOG)).toEqual({
      key: "located",
      direction: "b-to-a",
    });
  });

  it("regle vue depuis la cible (objet -> personnage : « Appartient a ») : le personnage possede l'objet", () => {
    // objet A cite personnage B : owns vu depuis la cible -> B -> A.
    expect(preselectRelation(epee, selyne, CATALOG)).toEqual({ key: "owns", direction: "b-to-a" });
    // dans l'autre orientation du geste : personnage A, objet B -> A -> B.
    expect(preselectRelation(selyne, epee, CATALOG)).toEqual({ key: "owns", direction: "a-to-b" });
  });

  it("aucune regle (personnage - personnage) : pas de pre-selection", () => {
    expect(preselectRelation(selyne, { ...selyne, id: "e-aldric" }, CATALOG)).toBeNull();
  });

  it("type pre-selectionne masque dans le monde : pas de pre-selection", () => {
    expect(preselectRelation(selyne, portBrume, { custom: [], hidden: ["located"] })).toBeNull();
  });
});

describe("linkFormFields", () => {
  it("dirige, sens A -> B : A est la source (point de vue « source »)", () => {
    expect(linkFormFields("e-aldric", "e-selyne", "parent", false, "a-to-b")).toEqual({
      entityId: "e-aldric",
      otherId: "e-selyne",
      choice: "parent|source",
    });
  });

  it("dirige, sens B -> A : A est la cible (point de vue « target »)", () => {
    // Geste de Selyne vers Aldric, sens choisi Aldric -> Selyne : Selyne
    // (fiche A) est la cible de « Parent de », elle lira « Enfant de : Aldric ».
    expect(linkFormFields("e-selyne", "e-aldric", "parent", false, "b-to-a")).toEqual({
      entityId: "e-selyne",
      otherId: "e-aldric",
      choice: "parent|target",
    });
  });

  it("symetrique : point de vue « source » quel que soit le sens", () => {
    expect(linkFormFields("e-a", "e-b", "family", true, "b-to-a").choice).toBe("family|source");
  });
});
