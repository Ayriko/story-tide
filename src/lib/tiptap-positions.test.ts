import { getSchema, type JSONContent } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { extractPlainText } from "./tiptap-content";
import { createEditorExtensions } from "./tiptap-extensions";
import { buildTextWithPositions, occurrenceToRange } from "./tiptap-positions";

// Meme schema que l'editeur reel/la validation serveur (tiptap-content.ts) -
// construit ici plutot qu'importe (le schema n'est pas exporte), pour tester
// contre un doc ProseMirror reel.
const schema = getSchema(createEditorExtensions());

function makeDoc(json: JSONContent): ProseMirrorNode {
  return ProseMirrorNode.fromJSON(schema, json);
}

describe("buildTextWithPositions", () => {
  it("produit le meme texte que extractPlainText pour un paragraphe simple", () => {
    const json: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Aeliana parle." }] }],
    };

    const { text, map } = buildTextWithPositions(makeDoc(json));

    expect(text).toBe(extractPlainText(json));
    expect(map).toHaveLength(text.length);
  });

  it("insere le meme separateur de bloc (\\n\\n) que extractPlainText entre deux blocs", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Chapitre 1" }] },
        { type: "paragraph", content: [{ type: "text", text: "Le roi Aldric regne." }] },
      ],
    };

    const { text, map } = buildTextWithPositions(makeDoc(json));

    expect(text).toBe(extractPlainText(json));
    expect(map).toHaveLength(text.length);
  });

  it("reste identique a extractPlainText pour une liste imbriquee (plusieurs niveaux de blocs)", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Valdoria" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Aldric" }] }],
            },
          ],
        },
      ],
    };

    const { text, map } = buildTextWithPositions(makeDoc(json));

    expect(text).toBe(extractPlainText(json));
    expect(map).toHaveLength(text.length);
  });

  it("reste identique a extractPlainText pour une citation (blockquote)", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Une prophetie ancienne." }] },
          ],
        },
      ],
    };

    const { text, map } = buildTextWithPositions(makeDoc(json));

    expect(text).toBe(extractPlainText(json));
    expect(map).toHaveLength(text.length);
  });

  it("reste identique a extractPlainText quand un mot est partiellement en gras (texte scinde en plusieurs nodes)", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Le roi " },
            { type: "text", marks: [{ type: "bold" }], text: "Aldric" },
            { type: "text", text: " regne." },
          ],
        },
      ],
    };

    const { text, map } = buildTextWithPositions(makeDoc(json));

    expect(text).toBe(extractPlainText(json));
    expect(map).toHaveLength(text.length);
  });
});

describe("occurrenceToRange", () => {
  it("remappe une occurrence en tete de document vers la position ProseMirror correspondante", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Valdoria borde le nord." }] },
      ],
    };
    const doc = makeDoc(json);
    const { text, map } = buildTextWithPositions(doc);
    const start = text.indexOf("Valdoria");

    const range = occurrenceToRange(map, start, start + "Valdoria".length);

    if (range === null) {
      throw new Error("occurrenceToRange n'aurait pas du renvoyer null ici");
    }
    expect(doc.textBetween(range.from, range.to)).toBe("Valdoria");
  });

  it("remappe une occurrence a cheval sur une frontiere de mark (gras partiel)", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Le roi " },
            { type: "text", marks: [{ type: "bold" }], text: "Aldric" },
            { type: "text", text: " regne." },
          ],
        },
      ],
    };
    const doc = makeDoc(json);
    const { text, map } = buildTextWithPositions(doc);
    const start = text.indexOf("Aldric");

    const range = occurrenceToRange(map, start, start + "Aldric".length);

    if (range === null) {
      throw new Error("occurrenceToRange n'aurait pas du renvoyer null ici");
    }
    expect(doc.textBetween(range.from, range.to)).toBe("Aldric");
  });

  it("remappe une occurrence apres un saut de bloc (deuxieme paragraphe)", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Prologue." }] },
        { type: "paragraph", content: [{ type: "text", text: "Aldric regne ici." }] },
      ],
    };
    const doc = makeDoc(json);
    const { text, map } = buildTextWithPositions(doc);
    const start = text.indexOf("Aldric");

    const range = occurrenceToRange(map, start, start + "Aldric".length);

    if (range === null) {
      throw new Error("occurrenceToRange n'aurait pas du renvoyer null ici");
    }
    expect(doc.textBetween(range.from, range.to)).toBe("Aldric");
  });

  it("retourne null si l'occurrence chevauche le separateur de bloc synthetique", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Fin." }] },
        { type: "paragraph", content: [{ type: "text", text: "Debut." }] },
      ],
    };
    const doc = makeDoc(json);
    const { text, map } = buildTextWithPositions(doc);
    const separatorStart = text.indexOf("Fin.") + "Fin.".length;

    expect(occurrenceToRange(map, separatorStart, separatorStart + 2)).toBeNull();
  });

  it("retourne null pour une plage vide ou inversee", () => {
    expect(occurrenceToRange([0, 1, 2], 5, 5)).toBeNull();
    expect(occurrenceToRange([0, 1, 2], 2, 1)).toBeNull();
  });
});
