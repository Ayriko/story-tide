import { describe, expect, it } from "vitest";
import { normalizeForMatch } from "./normalize";

describe("normalizeForMatch", () => {
  it("retourne une chaine vide pour une entree vide", () => {
    expect(normalizeForMatch("")).toBe("");
  });

  it("replie la casse (majuscules -> minuscules)", () => {
    expect(normalizeForMatch("AELIANA")).toBe("aeliana");
    expect(normalizeForMatch("Aeliana")).toBe("aeliana");
  });

  it("retire les accents courants (e, a, c, i, u, o)", () => {
    expect(normalizeForMatch("é")).toBe("e");
    expect(normalizeForMatch("à")).toBe("a");
    expect(normalizeForMatch("ç")).toBe("c");
    expect(normalizeForMatch("ï")).toBe("i");
    expect(normalizeForMatch("ù")).toBe("u");
    expect(normalizeForMatch("ô")).toBe("o");
  });

  it("laisse passante une chaine deja normalisee (passthrough)", () => {
    expect(normalizeForMatch("aeliana")).toBe("aeliana");
  });

  it("ne deplie PAS les ligatures oe/ae (ADR-0001 : alignement caractere-exact)", () => {
    // Cœur -> cœur (la ligature reste une seule "lettre", pas de decomposition
    // canonique NFD pour ce caractere) - jamais "coeur" (2 lettres), sinon la
    // longueur de la chaine change et casse l'alignement des positions de
    // surlignage avec le plainText d'origine.
    expect(normalizeForMatch("Cœur")).toBe("cœur");
    expect(normalizeForMatch("cœur")).toHaveLength("cœur".length);
    expect(normalizeForMatch("Æther")).toBe("æther");
  });

  it("traite un nom compose realiste avec accents, casse mixte et espace", () => {
    expect(normalizeForMatch("Général Éloïse")).toBe("general eloise");
  });

  it("preserve les espaces et la ponctuation (transformation caractere a caractere)", () => {
    expect(normalizeForMatch("Saint-Aldric, le Vieux")).toBe("saint-aldric, le vieux");
  });

  it("preserve la longueur de la chaine pour un texte purement accentue (alignement positions)", () => {
    const input = "Éloïse";
    expect(normalizeForMatch(input)).toHaveLength(input.length);
  });
});
