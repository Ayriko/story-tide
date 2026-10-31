import { describe, expect, it } from "vitest";
import type { StylesheetJson, StylesheetJsonBlock } from "cytoscape";
import { ENTITY_TYPE_GROUPS } from "./entity-schemas";
import {
  buildSkyStylesheet,
  SKY_DIM_IN_MS,
  SKY_DIM_OUT_MS,
  starGlowDiameter,
  starGlowSvg,
  tierHaloOpacity,
} from "./sky-stylesheet";
import { DEFAULT_SKY_PALETTE, type SkyPalette } from "./sky-theme";
import { STAR_TIERS, type BrightnessTier } from "./star-brightness";

// Palette aux valeurs reconnaissables : toute couleur de la feuille doit en
// venir (aucune couleur en dur).
const PALETTE: SkyPalette = {
  bg: "#000001",
  starByGroup: {
    Personnages: "#100001",
    Écologie: "#100002",
    Lieux: "#100003",
    Organisation: "#100004",
    Magie: "#100005",
    Lore: "#100006",
    Objets: "#100007",
    Divers: "#100008",
  },
  starDefault: "#200000",
  haloOpacity: 0.5,
  label: "#300000",
  labelHalo: "#400000",
  labelHaloOpacity: 0.7,
  lineDeclared: "#500000",
  lineDeclaredOpacity: 0.6,
  lineBridgeOpacity: 0.3,
  lineText: "#600000",
  lineTextOpacity: 0.2,
  lineTextWidth: 0.75,
  lineLabel: "#700000",
  accent: "#800000",
  dimOpacity: 0.3,
};
const TIERS: BrightnessTier[] = [0, 1, 2, 3];

function build(reducedMotion = false): StylesheetJson {
  return buildSkyStylesheet({ palette: PALETTE, fontFamily: "Inter", reducedMotion });
}

function block(sheet: StylesheetJson, selector: string): Record<string, unknown> {
  const found = sheet.find((entry: StylesheetJsonBlock) => entry.selector === selector);
  if (!found || !("style" in found)) {
    throw new Error(`selecteur absent : ${selector}`);
  }
  return Object.fromEntries(Object.entries(found.style));
}

function decodedImage(value: unknown): string {
  return decodeURIComponent(String(value).split(",")[1] ?? "");
}

// Arrets du degrade : [offset, opacite].
function stops(svg: string): [number, number][] {
  return [
    ...svg.matchAll(/offset='([\d.]+)' stop-color='#[0-9a-f]{6}' stop-opacity='([\d.]+)'/g),
  ].map((match) => [Number(match[1]), Number(match[2])]);
}

describe("starGlowSvg", () => {
  it("coeur plein puis un seul degrade radial qui s'eteint au bord, sans rayon", () => {
    const svg = starGlowSvg("#123456", 3, 0.35);
    expect(svg.match(/<radialGradient/g)).toHaveLength(1);
    expect(svg).not.toMatch(/<line|<path|<polygon/);
    const all = stops(svg);
    expect(all[0]).toEqual([0, 1]);
    expect(all.at(-1)).toEqual([1, 0]);
    // Lueur legere : hors du coeur, jamais plus opaque que demande.
    for (const [, opacity] of all.slice(2)) {
      expect(opacity).toBeLessThanOrEqual(0.35);
    }
  });

  it("le coeur garde le diametre du palier, la lueur grandit avec l'eclat", () => {
    for (const tier of TIERS) {
      const [, coreEdge] = stops(starGlowSvg("#123456", tier, 0.3));
      expect(coreEdge?.[0]).toBeCloseTo(STAR_TIERS[tier].size / starGlowDiameter(tier), 3);
      expect(coreEdge?.[1]).toBe(1);
    }
    expect(starGlowDiameter(3)).toBeGreaterThan(starGlowDiameter(2));
    expect(starGlowDiameter(0)).toBeGreaterThan(STAR_TIERS[0].size);
  });
});

describe("buildSkyStylesheet", () => {
  it("aucune fonction dans la feuille (recalcul de style bon marche)", () => {
    for (const entry of build()) {
      const style = "style" in entry ? entry.style : entry.css;
      for (const value of Object.values(style)) {
        expect(typeof value).not.toBe("function");
      }
    }
  });

  it("toutes les couleurs viennent de la palette, aucune en dur", () => {
    const allowed = new Set<string>([
      PALETTE.bg,
      ...Object.values(PALETTE.starByGroup),
      PALETTE.starDefault,
      PALETTE.label,
      PALETTE.labelHalo,
      PALETTE.lineDeclared,
      PALETTE.lineText,
      PALETTE.lineLabel,
      PALETTE.accent,
    ]);
    const text = build()
      .map((entry) => ("style" in entry ? entry.style : entry.css))
      .flatMap((style) => Object.values(style))
      .map((value) => (String(value).startsWith("data:image/svg") ? decodedImage(value) : value))
      .join(" ");
    const colors = text.match(/#[0-9a-f]{6}\b/gi) ?? [];
    expect(colors.length).toBeGreaterThan(10);
    for (const color of colors) {
      expect(allowed.has(color)).toBe(true);
    }
  });

  it("une image d'etoile par groupe et par palier, a la teinte du groupe", () => {
    const sheet = build();
    for (const group of ENTITY_TYPE_GROUPS) {
      for (const tier of TIERS) {
        const svg = decodedImage(
          block(sheet, `node[group = "${group}"][tier = ${tier}]`)["background-image"],
        );
        expect(svg).toContain(PALETTE.starByGroup[group]);
        const glow = Math.round(tierHaloOpacity(PALETTE, tier) * 1000) / 1000;
        expect(svg).toContain(`stop-opacity='${glow}'`);
      }
    }
  });

  it("palier d'eclat : coeur, lueur ; disque du noeud transparent ; lueur agrandie au survol", () => {
    const sheet = build();
    expect(block(sheet, "node")["background-opacity"]).toBe(0);
    for (const tier of TIERS) {
      const style = block(sheet, `node[tier = ${tier}]`);
      expect(style.width).toBe(STAR_TIERS[tier].size);
      expect(style["background-width"]).toBe(starGlowDiameter(tier));
      const hovered = block(sheet, `node.is-hovered[tier = ${tier}]`);
      expect(Number(hovered["background-width"])).toBeGreaterThan(starGlowDiameter(tier));
    }
  });

  it("noms masques par defaut, affiches par le niveau de detail, le survol et la selection", () => {
    const sheet = build();
    expect(block(sheet, "node").label).toBe("");
    expect(
      block(
        sheet,
        "node.is-named, node.is-hovered, node.is-lit, node.is-selected, node.link-source, node.link-target",
      ),
    ).toEqual({ label: "data(label)" });
  });

  it("aucune icone du type dans le canvas", () => {
    expect(JSON.stringify(build())).not.toMatch(/\[icon =/);
  });

  it("lignes : declaree pleine et lumineuse, texte fine et tres discrete par jetons", () => {
    const sheet = build();
    expect(block(sheet, 'edge[kind = "declared"]')).toMatchObject({
      "line-style": "solid",
      "line-color": PALETTE.lineDeclared,
      "line-opacity": PALETTE.lineDeclaredOpacity,
    });
    expect(block(sheet, "edge")).toMatchObject({
      width: PALETTE.lineTextWidth,
      "line-color": PALETTE.lineText,
      "line-opacity": PALETTE.lineTextOpacity,
      "target-arrow-shape": "none",
    });
    expect(block(sheet, 'edge[kind = "text"]')["line-style"]).toBe("dashed");
    expect(block(sheet, 'edge[?arrow][kind = "declared"]')).toEqual({
      "target-arrow-shape": "triangle",
    });
    // Aucune fleche sur les liens du texte (base : none).
    expect(sheet.some((entry) => entry.selector === "edge[?arrow]")).toBe(false);
  });

  it("ponts entre constellations : plus discrets, sans lueur, eclaires au survol", () => {
    const sheet = build();
    expect(block(sheet, "edge.is-bridge")).toEqual({
      "line-opacity": PALETTE.lineBridgeOpacity,
      "underlay-opacity": 0,
    });
    expect(PALETTE.lineBridgeOpacity).toBeLessThan(PALETTE.lineDeclaredOpacity);
    const textBridge = Number(block(sheet, 'edge[kind = "text"].is-bridge')["line-opacity"]);
    expect(textBridge).toBeLessThan(PALETTE.lineTextOpacity);
    expect(textBridge).toBeCloseTo(0.1, 3);
    const order = sheet.map((entry) => entry.selector);
    expect(order.indexOf("edge.is-lit")).toBeGreaterThan(
      order.indexOf('edge[kind = "text"].is-bridge'),
    );
  });

  it("libelles de relation : survol, zoom (monde peu dense) ou etoile selectionnee", () => {
    expect(
      block(build(), "edge.is-label-visible, edge.is-zoomed-in, edge.is-selected-edge"),
    ).toEqual({ "text-opacity": 1 });
  });

  it("attenuation : entree lente (300 ms), retour plus rapide (200 ms), 0 en reduced-motion", () => {
    const sheet = build();
    expect(block(sheet, ".is-dimmed")).toMatchObject({
      opacity: PALETTE.dimOpacity,
      "transition-duration": SKY_DIM_IN_MS,
      "transition-timing-function": "ease-out",
    });
    expect(block(sheet, "node")["transition-duration"]).toBe(SKY_DIM_OUT_MS);
    expect(block(sheet, "node")["transition-property"]).toBe("opacity");
    const calm = build(true);
    expect(block(calm, ".is-dimmed")["transition-duration"]).toBe(0);
    expect(block(calm, "node")["transition-duration"]).toBe(0);
    expect(block(calm, "edge")["transition-duration"]).toBe(0);
  });

  it("arrivee eteinte couche par couche, sans opacite (ni fondu ni etoile non cliquable)", () => {
    const sheet = build();
    const unlitNode = block(sheet, "node.is-unlit");
    expect(unlitNode).toMatchObject({ "background-image-opacity": 0, "text-opacity": 0 });
    expect(unlitNode.opacity).toBeUndefined();
    expect(unlitNode.visibility).toBeUndefined();
    expect(block(sheet, "edge.is-unlit")).toEqual({
      "line-opacity": 0,
      "text-opacity": 0,
      "underlay-opacity": 0,
    });
    const order = sheet.map((entry) => entry.selector);
    expect(order.indexOf("edge.is-unlit")).toBeGreaterThan(order.indexOf("edge.is-lit"));
  });

  it("etats de liaison et de selection sur l'accent", () => {
    const sheet = build();
    expect(block(sheet, "node.is-hovered, node.is-selected")["border-color"]).toBe(PALETTE.accent);
    expect(block(sheet, "edge.eh-ghost-edge")["line-color"]).toBe(PALETTE.accent);
    expect(block(sheet, "node.link-handle")).toMatchObject({
      "background-color": PALETTE.bg,
      "background-image": "none",
    });
  });

  it("palette par defaut : feuille construite sans erreur", () => {
    const sheet = buildSkyStylesheet({
      palette: DEFAULT_SKY_PALETTE,
      fontFamily: "Inter",
      reducedMotion: false,
    });
    expect(sheet.length).toBeGreaterThan(30);
  });
});
