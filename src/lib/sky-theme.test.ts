import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blend,
  contrastRatio,
  DEFAULT_SKY_PALETTE,
  parseSkyColor,
  parseSkyOpacity,
  parseSkyWidth,
  readSkyPalette,
  resolveSkyPalette,
  starColor,
} from "./sky-theme";

describe("parseSkyColor", () => {
  it.each([
    ["#0F2333", "#0f2333"],
    ["  #abc ", "#aabbcc"],
    ["rgb(28 58 75)", "#1c3a4b"],
    ["rgb(28, 58, 75)", "#1c3a4b"],
    ["rgba(28, 58, 75, 0.85)", "#1c3a4b"],
    ["rgb(28 58 75 / 0.85)", "#1c3a4b"],
  ])("%s -> %s", (raw, expected) => {
    expect(parseSkyColor(raw)).toBe(expected);
  });

  it.each(["", "oklch(1 0 0 / 10%)", "navy", "var(--primary)", "#12345", "rgb(300 0 0)"])(
    "refuse %j",
    (raw) => {
      expect(parseSkyColor(raw)).toBeNull();
    },
  );
});

describe("parseSkyOpacity", () => {
  it.each([
    ["0.35", 0.35],
    [" 1 ", 1],
    ["0", 0],
    ["40%", 0.4],
  ])("%s -> %s", (raw, expected) => {
    expect(parseSkyOpacity(raw)).toBe(expected);
  });

  it.each(["", "1.2", "-0.1", "abc"])("refuse %j", (raw) => {
    expect(parseSkyOpacity(raw)).toBeNull();
  });
});

describe("parseSkyWidth", () => {
  it.each([
    ["0.75", 0.75],
    ["1px", 1],
    [" 4 ", 4],
  ])("%s -> %s", (raw, expected) => {
    expect(parseSkyWidth(raw)).toBe(expected);
  });

  it.each(["", "0", "-1", "5", "abc"])("refuse %j", (raw) => {
    expect(parseSkyWidth(raw)).toBeNull();
  });
});

describe("resolveSkyPalette", () => {
  it("lit chaque jeton, groupes compris", () => {
    const tokens: Record<string, string> = {
      "--sky-bg": "#000000",
      "--sky-star-lieux": "#112233",
      "--sky-accent": "rgb(1 2 3)",
      "--sky-dim-opacity": "0.5",
    };
    const palette = resolveSkyPalette((token) => tokens[token] ?? "");
    expect(palette.bg).toBe("#000000");
    expect(palette.starByGroup.Lieux).toBe("#112233");
    expect(palette.accent).toBe("#010203");
    expect(palette.dimOpacity).toBe(0.5);
    // Jetons absents : defauts.
    expect(palette.starByGroup.Magie).toBe(DEFAULT_SKY_PALETTE.starByGroup.Magie);
    expect(palette.label).toBe(DEFAULT_SKY_PALETTE.label);
  });

  it("valeur manquante ou invalide : defaut sur, jamais une valeur illisible", () => {
    const palette = resolveSkyPalette((token) =>
      token === "--sky-bg" ? "oklch(0.2 0.03 240)" : token === "--sky-halo-opacity" ? "2" : "",
    );
    expect(palette).toEqual(DEFAULT_SKY_PALETTE);
  });

  it("les jetons livres dans globals.css correspondent aux defauts surs", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const palette = resolveSkyPalette((token) => {
      const match = new RegExp(`${token}:\\s*([^;]+);`).exec(css);
      return match?.[1] ?? "";
    });
    // --sky-accent vaut var(--primary) dans le CSS (resolu par le
    // navigateur) : seul jeton compare a part.
    expect({ ...palette, accent: DEFAULT_SKY_PALETTE.accent }).toEqual(DEFAULT_SKY_PALETTE);
    expect(css).toMatch(/--primary:\s*#667ec7;/);
  });

  it("total sous le titre : AA sur le ciel et sous le voile du titre au-dessus d'une etoile", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const read = (token: string) => new RegExp(`${token}:\s*([^;]+);`).exec(css)?.[1] ?? "";
    const total = parseSkyColor(read("--sky-total"));
    const veil = parseSkyColor(read("--sky-title-veil"));
    const veilOpacity = parseSkyOpacity(read("--sky-title-veil-opacity"));
    if (!total || !veil || veilOpacity === null) {
      throw new Error("jetons du total absents");
    }
    expect(contrastRatio(total, DEFAULT_SKY_PALETTE.bg)).toBeGreaterThanOrEqual(4.5);
    for (const star of Object.values(DEFAULT_SKY_PALETTE.starByGroup)) {
      expect(contrastRatio(total, blend(veil, star, veilOpacity))).toBeGreaterThanOrEqual(4.5);
    }
    // Plus discret que les libelles.
    expect(contrastRatio(total, DEFAULT_SKY_PALETTE.bg)).toBeLessThan(
      contrastRatio(DEFAULT_SKY_PALETTE.label, DEFAULT_SKY_PALETTE.bg),
    );
  });

  it("gris secondaire des panneaux en verre : AA meme avec une etoile pleine sous le verre", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const muted = parseSkyColor(/--glass-text-muted:\s*([^;]+);/.exec(css)?.[1] ?? "");
    const ink = parseSkyColor(/--card:\s*([^;]+);/.exec(css)?.[1] ?? "");
    expect(muted).not.toBeNull();
    expect(ink).not.toBeNull();
    if (!muted || !ink) {
      return;
    }
    // --glass-surface : INK a 85 %.
    expect(css).toMatch(/--glass-surface:\s*rgb\(28 58 75 \/ 0\.85\);/);
    const under = [DEFAULT_SKY_PALETTE.bg, ...Object.values(DEFAULT_SKY_PALETTE.starByGroup)];
    for (const color of under) {
      expect(contrastRatio(muted, blend(ink, color, 0.85))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("readSkyPalette", () => {
  it("lit les variables sur l'element donne (getComputedStyle)", () => {
    const element = document.createElement("div");
    element.style.setProperty("--sky-star-objets", "#123456");
    document.body.append(element);
    expect(readSkyPalette(element).starByGroup.Objets).toBe("#123456");
    element.remove();
  });
});

describe("starColor", () => {
  it("teinte du groupe, ou defaut pour un groupe inconnu", () => {
    expect(starColor(DEFAULT_SKY_PALETTE, "Lore")).toBe("#d95926");
    expect(starColor(DEFAULT_SKY_PALETTE, "Inconnu")).toBe(DEFAULT_SKY_PALETTE.starDefault);
    expect(starColor(DEFAULT_SKY_PALETTE, undefined)).toBe(DEFAULT_SKY_PALETTE.starDefault);
  });
});

describe("contraste", () => {
  it("valeurs de reference WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  it("blend compose une couleur sur une autre", () => {
    expect(blend("#ffffff", "#000000", 0.5)).toBe("#808080");
    expect(blend("#112233", "#000000", 1)).toBe("#112233");
  });

  it("palette par defaut : libelles AA sur le ciel, meme contour pose sur une etoile", () => {
    const p = DEFAULT_SKY_PALETTE;
    expect(contrastRatio(p.label, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.lineLabel, p.bg)).toBeGreaterThanOrEqual(4.5);
    for (const star of Object.values(p.starByGroup)) {
      expect(
        contrastRatio(p.label, blend(p.labelHalo, star, p.labelHaloOpacity)),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("lignes declarees : objet graphique a 3:1 au moins sur le ciel", () => {
    const p = DEFAULT_SKY_PALETTE;
    expect(
      contrastRatio(blend(p.lineDeclared, p.bg, p.lineDeclaredOpacity), p.bg),
    ).toBeGreaterThanOrEqual(3);
  });
});
