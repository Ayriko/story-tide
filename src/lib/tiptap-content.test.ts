import { describe, expect, it } from "vitest";
import {
  EMPTY_CONTENT,
  InvalidContentError,
  extractPlainText,
  parseContent,
} from "./tiptap-content";

describe("parseContent", () => {
  it("accepte un document vide", () => {
    const result = parseContent(EMPTY_CONTENT);
    expect(result).toEqual(EMPTY_CONTENT);
  });

  it("accepte un document avec les nodes/marks autorises (titre, gras, liste, citation, image)", () => {
    const content = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titre" }] },
        {
          type: "paragraph",
          content: [{ type: "text", marks: [{ type: "bold" }], text: "Gras" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }],
            },
          ],
        },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Citation" }] }],
        },
        { type: "image", attrs: { src: "https://example.com/x.png", alt: "desc" } },
      ],
    };

    expect(() => parseContent(content)).not.toThrow();
  });

  it("rejette un node hors allowlist (codeBlock, desactive dans le schema)", () => {
    const content = {
      type: "doc",
      content: [{ type: "codeBlock", content: [{ type: "text", text: "rm -rf /" }] }],
    };

    expect(() => parseContent(content)).toThrow(InvalidContentError);
  });

  it("rejette une structure malformee (type inconnu)", () => {
    expect(() => parseContent({ type: "not-a-real-node" })).toThrow(InvalidContentError);
  });

  it("rejette une entree qui n'est pas un objet", () => {
    expect(() => parseContent("<script>alert(1)</script>")).toThrow(InvalidContentError);
  });
});

describe("extractPlainText", () => {
  it("retourne une chaine vide pour un document vide", () => {
    expect(extractPlainText(EMPTY_CONTENT)).toBe("");
  });

  it("concatene le texte des paragraphes et titres", () => {
    const content = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Aeliana" }] },
        { type: "paragraph", content: [{ type: "text", text: "La reine du nord." }] },
      ],
    };

    expect(extractPlainText(content)).toContain("Aeliana");
    expect(extractPlainText(content)).toContain("La reine du nord.");
  });
});
