import { describe, expect, it } from "vitest";
import { filterMentionSuggestions } from "./tiptap-extensions";

describe("filterMentionSuggestions", () => {
  const entities = [
    { id: "e1", label: "Aeliana" },
    { id: "e2", label: "Robert" },
    { id: "e3", label: "Château de Valombre" },
  ];

  it("retourne toutes les entites (bornees) pour une requete vide", () => {
    expect(filterMentionSuggestions(entities, "")).toEqual(entities);
  });

  it("filtre par sous-chaine insensible a la casse", () => {
    expect(filterMentionSuggestions(entities, "rob")).toEqual([entities[1]]);
  });

  it("filtre par sous-chaine insensible aux accents", () => {
    expect(filterMentionSuggestions(entities, "chateau")).toEqual([entities[2]]);
  });

  it("retourne un tableau vide si aucune entite ne correspond", () => {
    expect(filterMentionSuggestions(entities, "zzz")).toEqual([]);
  });

  it("ignore les espaces de bordure de la requete", () => {
    expect(filterMentionSuggestions(entities, "  rob  ")).toEqual([entities[1]]);
  });

  it("borne le nombre de resultats (MAX_MENTION_SUGGESTIONS)", () => {
    const manyEntities = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      label: `Entite ${i}`,
    }));

    expect(filterMentionSuggestions(manyEntities, "")).toHaveLength(8);
  });
});
