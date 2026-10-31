import { describe, expect, it } from "vitest";
import { generatePerfWorld } from "./perf-world-generator";
import {
  communityGroups,
  DECLARED_WEIGHT,
  detectCommunities,
  TEXT_WEIGHT,
  type WeightedEdge,
} from "./sky-communities";

// Clique ponderee entre les ids donnes.
function clique(ids: string[], weight = TEXT_WEIGHT): WeightedEdge[] {
  const edges: WeightedEdge[] = [];
  ids.forEach((a, i) =>
    ids.slice(i + 1).forEach((b) => edges.push({ source: a, target: b, weight })),
  );
  return edges;
}

describe("detectCommunities", () => {
  it("deux grappes reliees par un seul lien : deux constellations", () => {
    const left = ["a1", "a2", "a3", "a4"];
    const right = ["b1", "b2", "b3", "b4"];
    const communities = detectCommunities(
      [...left, ...right],
      [...clique(left), ...clique(right), { source: "a1", target: "b1", weight: TEXT_WEIGHT }],
    );
    expect(communityGroups(communities)).toEqual([left, right]);
    // Etiquette = plus petit id du groupe.
    expect(communities.get("a3")).toBe("a1");
    expect(communities.get("b4")).toBe("b1");
  });

  it("une relation declaree pese plus qu'un lien du texte", () => {
    const left = ["a1", "a2", "a3"];
    const right = ["b1", "b2", "b3"];
    const edges = [
      ...clique(left),
      ...clique(right),
      // « pont » : un lien du texte vers la gauche, une relation declaree
      // vers la droite.
      { source: "pont", target: "a1", weight: TEXT_WEIGHT },
      { source: "pont", target: "b1", weight: DECLARED_WEIGHT },
    ];
    const communities = detectCommunities([...left, ...right, "pont"], edges);
    expect(communities.get("pont")).toBe(communities.get("b1"));
  });

  it("entree sans lien : sa propre communaute ; monde vide : rien", () => {
    const communities = detectCommunities(
      ["a", "b", "seule"],
      [{ source: "a", target: "b", weight: 1 }],
    );
    expect(communities.get("seule")).toBe("seule");
    expect(communities.get("b")).toBe("a");
    expect(detectCommunities([], []).size).toBe(0);
  });

  it("aretes invalides ignorees (boucle, extremite inconnue, poids nul)", () => {
    const communities = detectCommunities(
      ["a", "b"],
      [
        { source: "a", target: "a", weight: 5 },
        { source: "a", target: "inconnue", weight: 5 },
        { source: "a", target: "b", weight: 0 },
      ],
    );
    expect(communities.get("a")).toBe("a");
    expect(communities.get("b")).toBe("b");
  });

  it("deterministe : meme resultat quel que soit l'ordre des donnees", () => {
    const ids = ["c", "a", "e", "b", "d", "f"];
    const edges = [
      ...clique(["a", "b", "c"]),
      ...clique(["d", "e", "f"], 2),
      { source: "c", target: "d", weight: 1 },
    ];
    const forward = detectCommunities(ids, edges);
    const backward = detectCommunities([...ids].reverse(), [...edges].reverse());
    expect([...backward].sort()).toEqual([...forward].sort());
  });

  it("monde de test de 300 : retrouve ses 5 grappes, les etoiles sans lien a part", () => {
    const plan = generatePerfWorld();
    const ids = plan.entities.map((entity) => entity.ref);
    const edges: WeightedEdge[] = [
      ...plan.textLinks.map((link) => ({
        source: ids[link.source] ?? "",
        target: ids[link.target] ?? "",
        weight: TEXT_WEIGHT,
      })),
      ...plan.declared.map((relation) => ({
        source: ids[relation.source] ?? "",
        target: ids[relation.target] ?? "",
        weight: DECLARED_WEIGHT,
      })),
    ];
    const groups = communityGroups(detectCommunities(ids, edges));
    const big = groups.filter((group) => group.length > 1);
    expect(big).toHaveLength(5);
    expect(big.every((group) => group.length >= 40)).toBe(true);
    expect(groups.filter((group) => group.length === 1)).toHaveLength(10);
  });
});
