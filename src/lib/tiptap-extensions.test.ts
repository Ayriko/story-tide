import { describe, expect, it } from "vitest";
import { generateJSON } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import { createEditorExtensions, filterMentionSuggestions } from "./tiptap-extensions";
import { splitParagraphsOnBreaks } from "./tiptap-paste";

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

// SafeLink (KAN-36 bugfix P1) : generateJSON reproduit le parsing HTML reel
// d'un collage (DOMParser + schema Tiptap), sans navigateur - c'est le seul
// chemin qui exerce vraiment parseHTML()/getAttrs de la mark link, contrairement
// a un test qui construirait le JSON ProseMirror a la main (deja couvert par
// tiptap-content.test.ts, mais qui ne prouve rien sur ce qui se passe au
// COLLAGE cote client, seulement sur ce que le serveur accepte une fois le
// JSON deja construit).
function hasLinkMark(node: JSONContent): boolean {
  if (node.marks?.some((mark) => mark.type === "link")) {
    return true;
  }
  return (node.content ?? []).some(hasLinkMark);
}

function extractText(node: JSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }
  return (node.content ?? []).map(extractText).join("");
}

describe("createEditorExtensions — assainissement des liens colles (SafeLink)", () => {
  const extensions = createEditorExtensions();

  it("retire un lien colle avec un href relatif contenant des espaces (Obsidian) mais garde le texte", () => {
    const html =
      '<p><a target="_blank" rel="noopener noreferrer nofollow" class="internal-link" href="Cultistes des souterrains">Cultistes des souterrains</a></p>';
    const doc = generateJSON(html, extensions);

    expect(hasLinkMark(doc)).toBe(false);
    expect(extractText(doc)).toBe("Cultistes des souterrains");
  });

  it("conserve un lien colle avec un href http(s) absolu valide", () => {
    const html = '<p><a href="https://example.com/page">Une page</a></p>';
    const doc = generateJSON(html, extensions);

    expect(hasLinkMark(doc)).toBe(true);
    expect(extractText(doc)).toBe("Une page");
  });

  it("retire un lien colle avec un href en protocole app: (Obsidian)", () => {
    const html = '<p><a href="app://obsidian.md/Zone%20perdue">Zone perdue</a></p>';
    const doc = generateJSON(html, extensions);

    expect(hasLinkMark(doc)).toBe(false);
    expect(extractText(doc)).toBe("Zone perdue");
  });

  it("retire un lien colle avec un href relatif (chemin de fichier)", () => {
    const html = '<p><a href="./note-relative">Une note</a></p>';
    const doc = generateJSON(html, extensions);

    expect(hasLinkMark(doc)).toBe(false);
    expect(extractText(doc)).toBe("Une note");
  });

  it("retire un lien colle avec un href javascript: (XSS) et n'en laisse aucune trace dans le JSON", () => {
    const html = '<p><a href="javascript:alert(1)">Cliquez ici</a></p>';
    const doc = generateJSON(html, extensions);

    expect(hasLinkMark(doc)).toBe(false);
    expect(extractText(doc)).toBe("Cliquez ici");
    expect(JSON.stringify(doc)).not.toContain("javascript:");
  });

  it("retire un lien colle avec un href vide", () => {
    const html = '<p><a href="">Texte sans cible</a></p>';
    const doc = generateJSON(html, extensions);

    expect(hasLinkMark(doc)).toBe(false);
    expect(extractText(doc)).toBe("Texte sans cible");
  });
});

// splitParagraphsOnBreaks (KAN-39 volet 2) : transformPastedHTML agit sur le
// pipeline presse-papier d'une vraie EditorView - generateJSON (ci-dessus) ne
// l'exerce PAS (il parse une chaine HTML statique, sans passer par le hook de
// collage). Se teste donc directement comme fonction pure (chaine HTML en
// entree, chaine HTML en sortie, reanalysee ici via DOMParser).
describe("splitParagraphsOnBreaks", () => {
  function paragraphTexts(html: string): string[] {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return Array.from(doc.body.querySelectorAll("p")).map((p) => p.textContent ?? "");
  }

  it("scinde un <p> contenant un <br> en deux paragraphes", () => {
    const result = splitParagraphsOnBreaks("<p>a<br>b</p>");
    expect(paragraphTexts(result)).toEqual(["a", "b"]);
  });

  it("ne cree pas de paragraphe vide pour des <br> consecutifs", () => {
    const result = splitParagraphsOnBreaks("<p>a<br><br>b</p>");
    expect(paragraphTexts(result)).toEqual(["a", "b"]);
  });

  it("ne cree pas de paragraphe vide pour un <br> en fin de bloc", () => {
    const result = splitParagraphsOnBreaks("<p>texte<br></p>");
    expect(paragraphTexts(result)).toEqual(["texte"]);
  });

  it("preserve les marks inline qui ne traversent pas un <br>", () => {
    const result = splitParagraphsOnBreaks("<p><strong>a</strong><br>b</p>");
    const doc = new DOMParser().parseFromString(result, "text/html");
    const paragraphs = Array.from(doc.body.querySelectorAll("p"));
    const [firstParagraph, secondParagraph] = paragraphs;

    expect(paragraphs).toHaveLength(2);
    if (!firstParagraph || !secondParagraph) {
      throw new Error("unreachable, verifie par toHaveLength ci-dessus");
    }
    expect(firstParagraph.innerHTML).toBe("<strong>a</strong>");
    expect(secondParagraph.textContent).toBe("b");
  });

  it("laisse un <p> sans <br> inchange", () => {
    const result = splitParagraphsOnBreaks("<p>simple</p>");
    expect(paragraphTexts(result)).toEqual(["simple"]);
  });
});

describe("SafeLink + splitParagraphsOnBreaks — collage Obsidian complet (integration)", () => {
  it("assainit le lien ET scinde les paragraphes d'un collage Obsidian realiste", () => {
    const obsidianHtml =
      '<p>Rencontre avec <a target="_blank" rel="noopener noreferrer nofollow" class="internal-link" href="Cultistes des souterrains">Cultistes des souterrains</a>.<br>Sous-titre</p>';

    // Ordre reel du pipeline de collage : transformPastedHTML (chaine ->
    // chaine) PUIS parsing schema-aware (generateJSON) - composes ici
    // manuellement pour reproduire fidelement l'enchainement sans navigateur
    // reel (Playwright), impossible a exercer via generateJSON seul (qui ne
    // passe jamais par le hook de collage).
    const transformed = splitParagraphsOnBreaks(obsidianHtml);
    const doc = generateJSON(transformed, createEditorExtensions());

    expect(hasLinkMark(doc)).toBe(false);

    const paragraphs = doc.content ?? [];
    const [firstParagraph, secondParagraph] = paragraphs;

    expect(paragraphs).toHaveLength(2);
    if (!firstParagraph || !secondParagraph) {
      throw new Error("unreachable, verifie par toHaveLength ci-dessus");
    }
    expect(extractText(firstParagraph)).toContain("Cultistes des souterrains");
    expect(extractText(secondParagraph)).toBe("Sous-titre");
  });
});

// ResizableImage (KAN-39 volet 5) : generateJSON est le seul chemin qui
// exerce vraiment le parseHTML de l'attribut `width` (round-trip HTML ->
// JSON), comme pour SafeLink - un test construit a la main sur le JSON
// (tiptap-content.test.ts) ne prouve rien sur ce que produit un vrai parsing
// HTML (frappe/collage/generateHTML).
describe("createEditorExtensions — attribut width de l'image (ResizableImage)", () => {
  it("lit le pourcentage depuis le style inline width au parsing HTML", () => {
    const html = '<img src="https://example.com/x.png" alt="desc" style="width: 37%">';
    const doc = generateJSON(html, createEditorExtensions());

    const [imageNode] = doc.content ?? [];
    expect(imageNode?.type).toBe("image");
    expect(imageNode?.attrs?.width).toBe(37);
  });

  it("retombe a 100 si le style width est absent ou dans un format inattendu", () => {
    const html = '<img src="https://example.com/x.png" alt="desc">';
    const doc = generateJSON(html, createEditorExtensions());

    const [imageNode] = doc.content ?? [];
    expect(imageNode?.attrs?.width).toBe(100);
  });
});
