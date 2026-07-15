import { describe, expect, it } from "vitest";
import { AhoCorasick, type Pattern } from "./aho-corasick";

describe("AhoCorasick", () => {
  it("retourne aucun match quand le dictionnaire est vide", () => {
    const ac = new AhoCorasick([]);
    expect(ac.search("Aeliana règne sur le nord.")).toEqual([]);
  });

  it("retourne aucun match quand aucun motif n'apparaît dans le texte", () => {
    const ac = new AhoCorasick([{ entityId: "1", term: "Aeliana" }]);
    expect(ac.search("Un texte qui ne mentionne personne.")).toEqual([]);
  });

  it("trouve un motif unique avec les bornes exactes", () => {
    const ac = new AhoCorasick([{ entityId: "1", term: "Aeliana" }]);
    const text = "Aeliana règne sur le nord.";
    expect(ac.search(text)).toEqual([{ entityId: "1", term: "Aeliana", start: 0, end: 7 }]);
  });

  it("ignore silencieusement un motif vide ou uniquement fait d'espaces", () => {
    const ac = new AhoCorasick([
      { entityId: "1", term: "" },
      { entityId: "2", term: "   " },
      { entityId: "3", term: "Aeliana" },
    ]);
    expect(ac.search("Aeliana.")).toEqual([{ entityId: "3", term: "Aeliana", start: 0, end: 7 }]);
  });

  it("respecte les frontières de mots (Ann ne matche pas dans Annexe)", () => {
    const ac = new AhoCorasick([{ entityId: "1", term: "Ann" }]);
    expect(ac.search("Voir en annexe.")).toEqual([]);
  });

  it("priorise le plus long match sur un depart partage (Jon Neige > Jon)", () => {
    const ac = new AhoCorasick([
      { entityId: "1", term: "Jon" },
      { entityId: "2", term: "Jon Neige" },
    ]);
    const text = "Jon Neige garde le mur.";
    expect(ac.search(text)).toEqual([{ entityId: "2", term: "Jon Neige", start: 0, end: 9 }]);
  });

  it("documente la politique leftmost-match : un match plus court mais qui demarre avant en supprime un plus long qui chevauche", () => {
    // "Jon Neige" (start0-9) et "Neige Blanche" (start4-17) chevauchent tous
    // les deux en respectant les frontieres de mots. Politique de cette
    // implementation (tri debut croissant, longueur decroissante) : le match
    // qui demarre le plus tot ("Jon Neige", 9 caracteres) est retenu et
    // supprime tout chevauchement ulterieur, meme "Neige Blanche" qui est
    // pourtant plus long (13 caracteres). Verrouille le comportement REEL
    // (pas une recherche du recouvrement globalement optimal).
    const ac = new AhoCorasick([
      { entityId: "1", term: "Jon Neige" },
      { entityId: "2", term: "Neige Blanche" },
    ]);
    expect(ac.search("Jon Neige Blanche.")).toEqual([
      { entityId: "1", term: "Jon Neige", start: 0, end: 9 },
    ]);
  });

  it("conserve tous les homonymes matchant exactement les memes bornes", () => {
    const ac = new AhoCorasick([
      { entityId: "1", term: "Aeliana" },
      { entityId: "2", term: "Aeliana" },
    ]);
    const result = ac.search("Aeliana.");
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.entityId).sort()).toEqual(["1", "2"]);
    expect(result.every((m) => m.start === 0 && m.end === 7)).toBe(true);
  });

  it("matche independamment plusieurs alias de la meme entite", () => {
    const ac = new AhoCorasick([
      { entityId: "1", term: "Jon Neige" },
      { entityId: "1", term: "Roi du Nord" },
    ]);
    const text = "Jon Neige est aussi le Roi du Nord.";
    const result = ac.search(text);
    expect(result).toEqual([
      { entityId: "1", term: "Jon Neige", start: 0, end: 9 },
      { entityId: "1", term: "Roi du Nord", start: 23, end: 34 },
    ]);
  });

  it("matche indifferemment de la casse et des accents (integration normalizeForMatch)", () => {
    const ac = new AhoCorasick([{ entityId: "1", term: "Éloïse" }]);
    const text = "eloise dort.";
    expect(ac.search(text)).toEqual([{ entityId: "1", term: "Éloïse", start: 0, end: 6 }]);
  });

  it("preserve les ligatures (ADR-0001) : ne deplie pas oe en cœur", () => {
    const ac = new AhoCorasick([{ entityId: "1", term: "Cœur-de-Pierre" }]);
    expect(ac.search("Le Cœur-de-Pierre se dresse.")).toEqual([
      { entityId: "1", term: "Cœur-de-Pierre", start: 3, end: 17 },
    ]);
    expect(ac.search("Le Coeur-de-Pierre (deplie) se dresse.")).toEqual([]);
  });

  it("gere plusieurs motifs distincts dans le meme texte, positions exactes", () => {
    const patterns: Pattern[] = [
      { entityId: "1", term: "Aeliana" },
      { entityId: "2", term: "Robert" },
    ];
    const ac = new AhoCorasick(patterns);
    const text = "Robert parle avec Aeliana.";
    expect(ac.search(text)).toEqual([
      { entityId: "2", term: "Robert", start: 0, end: 6 },
      { entityId: "1", term: "Aeliana", start: 18, end: 25 },
    ]);
  });

  it("tient la charge d'un gros copier-coller/import (dictionnaire large x texte volumineux)", () => {
    // Cas reel vise : un utilisateur colle ou importe un gros bloc de texte
    // d'un coup dans une fiche. Le pari du moteur (spec §4.4) est de rester
    // ~O(longueur du texte), quasi independant du nombre de motifs - ce test
    // le verrouille en volume, pas seulement sur les petits cas ci-dessus.
    //
    // Termes zero-paddes a longueur fixe ("Entite000".."Entite199") : aucun
    // n'est prefixe d'un autre, donc le compte de matches est trivialement
    // deterministe (pas de piege plus-long-match/frontiere a raisonner ici,
    // deja couvert par les tests precedents).
    const entityCount = 200;
    const patterns: Pattern[] = Array.from({ length: entityCount }, (_, i) => ({
      entityId: `entity-${i}`,
      term: `Entite${String(i).padStart(3, "0")}`,
    }));
    const ac = new AhoCorasick(patterns);

    // Paragraphe mentionnant chaque entite une fois, entrecoupe de mots hors
    // dictionnaire (simule un texte importe) ; repete pour atteindre un
    // volume representatif d'un gros paste (~100k caracteres).
    const repetitions = 50;
    const paragraph = patterns
      .map((p) => `${p.term} traverse la foret et rencontre un allie de passage.`)
      .join(" ");
    const bigText = Array.from({ length: repetitions }, () => paragraph).join(" ");

    const matches = ac.search(bigText);

    // Rien perdu : une occurrence par entite et par repetition du paragraphe.
    expect(matches).toHaveLength(entityCount * repetitions);
    // Bornes toutes valides (alignement caractere-exact requis pour le futur
    // surlignage UI).
    expect(matches.every((m) => m.start >= 0 && m.start < m.end && m.end <= bigText.length)).toBe(
      true,
    );
    // Chaque entite du dictionnaire est bien liee au moins une fois.
    expect(new Set(matches.map((m) => m.entityId)).size).toBe(entityCount);

    // Pas d'assertion sur un chrono (performance.now() est flaky en CI sous
    // charge) : le timeout par defaut de Vitest (5s, non surcharge dans
    // vitest.config.ts) suffit deja a faire echouer ce test si le moteur
    // regressait en O(n*m) - un texte de ~100k caracteres scanne en quelques
    // ms avec un automate correct.
  });
});
