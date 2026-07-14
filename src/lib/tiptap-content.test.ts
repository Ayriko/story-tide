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

  it("rejette une image avec un src qui n'est pas une URL syntaxiquement valide", () => {
    const content = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "not-a-url-at-all", alt: "desc" } }],
    };

    expect(() => parseContent(content)).toThrow(InvalidContentError);
  });

  it("s'arrete a la premiere violation rencontree quand il y en a plusieurs", () => {
    const content = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "javascript:alert(1)", alt: "desc" } },
        { type: "image", attrs: { src: "javascript:alert(2)", alt: "desc" } },
      ],
    };

    expect(() => parseContent(content)).toThrow(InvalidContentError);
  });

  it("rejette une image avec un src non http(s) (javascript:)", () => {
    const content = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "javascript:alert(1)", alt: "desc" } }],
    };

    expect(() => parseContent(content)).toThrow(InvalidContentError);
  });

  it("rejette une image avec un src en data:", () => {
    const content = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "data:text/html,<script>alert(1)</script>", alt: "desc" } }],
    };

    expect(() => parseContent(content)).toThrow(InvalidContentError);
  });

  it("rejette une image sans texte alternatif (RGAA impose aussi cote serveur)", () => {
    const content = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "https://example.com/x.png", alt: "" } }],
    };

    expect(() => parseContent(content)).toThrow(InvalidContentError);
  });

  it("rejette un src d'image trop long", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: `https://example.com/${"a".repeat(2050)}`, alt: "desc" },
        },
      ],
    };

    expect(() => parseContent(content)).toThrow(InvalidContentError);
  });

  it("rejette un lien avec un href non http(s) (javascript:)", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }], text: "clic" },
          ],
        },
      ],
    };

    expect(() => parseContent(content)).toThrow(InvalidContentError);
  });

  it("accepte une image http(s) avec alt et un lien http(s)", () => {
    const content = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "https://example.com/x.png", alt: "desc" } },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
              text: "clic",
            },
          ],
        },
      ],
    };

    expect(() => parseContent(content)).not.toThrow();
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
