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

  // [DIAGNOSTIC, session normalisation Unicode NFC/NFD] normalizeForMatch
  // (normalize.ts) applique .normalize("NFD") + strip \p{M} sur LA CHAINE
  // ENTIERE en un seul appel - contrairement a une normalisation caractere
  // par caractere. Hypothese testee : un texte deja en forme NFD (accent =
  // caractere combinant separe, ex. macOS/export tiers) pourrait echapper a
  // la detection si l'entite est enregistree en forme NFC (ou l'inverse).
  // Documente le comportement REEL, que le resultat confirme ou infirme
  // l'hypothese - voir le rapport de diagnostic pour la conclusion.
  describe("[DIAGNOSTIC] formes Unicode NFC vs NFD", () => {
    const nfc = "Éléa"; // forme precomposee : "É" = U+00C9 (1 code point)
    const nfd = nfc.normalize("NFD"); // meme entite, forme decomposee : "E" + U+0301

    it("verifie la premisse : NFC et NFD sont bien deux chaines JS distinctes", () => {
      expect(nfc).not.toBe(nfd);
      expect(nfc.length).toBe(4);
      expect(nfd.length).toBe(6); // 2 caracteres accentues x1 marque combinante chacun
    });

    it("cas temoin : motif NFC, texte NFC (meme forme des deux cotes)", () => {
      const ac = new AhoCorasick([{ entityId: "1", term: nfc }]);
      expect(ac.search(`Ici vit ${nfc} en paix.`)).toHaveLength(1);
    });

    it("cas temoin : motif NFD, texte NFD (meme forme des deux cotes)", () => {
      const ac = new AhoCorasick([{ entityId: "1", term: nfd }]);
      expect(ac.search(`Ici vit ${nfd} en paix.`)).toHaveLength(1);
    });

    it("motif NFC, texte NFD (entite saisie normalement, texte colle depuis une source NFD)", () => {
      const ac = new AhoCorasick([{ entityId: "1", term: nfc }]);
      expect(ac.search(`Ici vit ${nfd} en paix.`)).toHaveLength(1);
    });

    it("motif NFD, texte NFC (croisement inverse)", () => {
      const ac = new AhoCorasick([{ entityId: "1", term: nfd }]);
      expect(ac.search(`Ici vit ${nfc} en paix.`)).toHaveLength(1);
    });

    // LIMITE CONNUE DU MOTEUR, MITIGEE A LA FRONTIERE (ADR-0020, pas dans ce
    // fichier) : search() calcule ses positions sur la chaine NORMALISEE
    // (normalizeForMatch(text) peut etre PLUS COURTE que le texte ORIGINAL si
    // celui-ci contient deja des marques combinantes NFD - retirees par le
    // strip \p{M}) puis les utilise TELLES QUELLES comme des indices dans le
    // texte ORIGINAL, y compris pour la verification des frontieres de mots
    // (`isWordChar(text[start-1])`, `text[end]` - aho-corasick.ts).
    // Consequence : le decalage introduit par "Éléa" en forme NFD (2 marques
    // combinantes retirees) fait tomber la frontiere de mot de "Robert" sur
    // un "e" (milieu du mot precedent dans le texte original) -> la
    // verification `isWordChar` rejette le match, et "Robert" disparait
    // ENTIEREMENT des resultats, alors qu'il ne contient lui-meme AUCUN
    // caractere accentue - pas seulement l'entite accentuee, N'IMPORTE
    // QUELLE AUTRE entite mentionnee PLUS LOIN dans le meme texte. Arbitrage
    // (ADR-0020) : corriger a LA FRONTIERE (NFC sur name/aliases a
    // l'enregistrement, NFC sur les noeuds texte du body Tiptap a la
    // sauvegarde - entity-service.ts, tiptap-content.ts), PAS ICI - un
    // .normalize("NFC") ajoute dans normalizeForMatch romprait le meme
    // invariant d'alignement, juste plus tot dans le pipeline. Ce test PIN le
    // comportement du moteur PUR, isole, recevant explicitement du texte
    // NON normalise (`undefined` volontairement documente comme tel) : ce
    // n'est plus un bug ouvert mais une caracteristique connue et assumee du
    // moteur, dont la frontiere applicative garantit desormais qu'il ne la
    // rencontre plus en pratique - voir le test suivant.
    it("[connu, mitige a la frontiere - ADR-0020] une sequence NFD plus tot dans le texte fait disparaitre un match ULTERIEUR (frontiere de mot faussee)", () => {
      const ac = new AhoCorasick([
        { entityId: "elea", term: nfc },
        { entityId: "robert", term: "Robert" },
      ]);
      const text = `Ici vit ${nfd} qui parle avec Robert dans la foret.`;

      const matches = ac.search(text);

      const elea = matches.find((m) => m.entityId === "elea");
      const robert = matches.find((m) => m.entityId === "robert");

      // Bornes REELLES de "Robert" dans le texte original ("Robert" ne
      // contient aucun accent, son propre calcul de bornes ne devrait
      // dependre de rien d'autre) - ce que la frontiere NFC garantit desormais.
      expect(text.indexOf("Robert")).toBe(30);

      // Comportement du moteur PUR face a du texte NON normalise : "elea" est
      // trouve mais avec des bornes fausses (decalees de -2) ...
      expect(elea).toEqual({ entityId: "elea", term: nfc, start: 8, end: 12 });
      // ... et "robert" ne fait meme plus partie des resultats : DISPARU.
      expect(robert).toBeUndefined();
    });

    // NON-REGRESSION (ADR-0020) : reproduit EXACTEMENT le meme scenario que
    // le test precedent (meme texte, memes entites, "Robert" plus loin dans
    // le texte) mais avec du texte NFC - la forme que la frontiere
    // applicative garantit desormais TOUJOURS avant qu'un texte n'atteigne
    // ce moteur (entity-service.ts normalise name/aliases a l'ecriture,
    // tiptap-content.ts normalise le body a la sauvegarde). Prouve que la
    // mitigation choisie (frontiere, pas moteur) elimine reellement le cas
    // qui faisait disparaitre "Robert" ci-dessus, sans toucher a
    // aho-corasick.ts ni normalize.ts.
    it("[non-regression, ADR-0020] avec un texte deja NFC (garanti par la frontiere applicative), aucun match n'est perdu", () => {
      const ac = new AhoCorasick([
        { entityId: "elea", term: nfc },
        { entityId: "robert", term: "Robert" },
      ]);
      // Meme contenu que le cas bugue, mais normalise en NFC AVANT d'etre
      // assemble - exactement ce que produit desormais entity-service.ts/
      // tiptap-content.ts (normalisation par noeud, avant persistance),
      // jamais un texte deja assemble puis normalise apres coup. La sequence
      // NFD ("Éléa") redevient sa forme precomposee (4 caracteres, pas 6) des
      // l'origine - le texte final est donc naturellement plus court que le
      // texte NON normalise du test precedent, et "Robert" y est bien a une
      // position DIFFERENTE (28 au lieu de 30) mais CORRECTE pour CE texte.
      const text = `Ici vit ${nfd} qui parle avec Robert dans la foret.`.normalize("NFC");
      expect(text).toBe(`Ici vit ${nfc} qui parle avec Robert dans la foret.`);

      const matches = ac.search(text);

      const elea = matches.find((m) => m.entityId === "elea");
      const robert = matches.find((m) => m.entityId === "robert");

      expect(elea).toEqual({ entityId: "elea", term: nfc, start: 8, end: 12 });
      expect(robert).toEqual({ entityId: "robert", term: "Robert", start: 28, end: 34 });
      expect(text.slice(elea?.start, elea?.end)).toBe(nfc);
      expect(text.slice(robert?.start, robert?.end)).toBe("Robert");
    });
  });
});
