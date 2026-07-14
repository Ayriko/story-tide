import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("met en minuscules et remplace les espaces par des tirets", () => {
    expect(slugify("Le Royaume des Sables")).toBe("le-royaume-des-sables");
  });

  it("retire les accents", () => {
    expect(
      slugify(String.fromCodePoint(0xc9) + "toile Ancr" + String.fromCodePoint(0xe9) + "e"),
    ).toBe("etoile-ancree");
  });

  it("effondre les espaces multiples et coupe les tirets de bord", () => {
    expect(slugify("   Multiple   espaces   ")).toBe("multiple-espaces");
  });

  it("remplace la ponctuation par des tirets", () => {
    expect(slugify("L'Empire d'Or & de Sang !")).toBe("l-empire-d-or-de-sang");
  });

  it("se replie sur 'monde' si le nom ne contient aucun caractere alphanumerique", () => {
    expect(slugify("!!!")).toBe("monde");
  });
});
