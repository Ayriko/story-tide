import { ENTITY_TYPE_GROUPS, type EntityTypeGroup } from "./entity-schemas";

// Jetons du ciel d'histoires (KAN-85, ADR-0033). Toute l'ambiance de la
// Constellation passe par des variables CSS (globals.css, prefixe --sky-) :
// principe 7 de la vision, le theme de base est une scene parametrable. Le
// canvas Cytoscape ne sait pas lire une variable CSS : ce resolveur UNIQUE les
// lit une fois au montage (getComputedStyle sur le conteneur de la
// Constellation - une surcharge future par monde n'aura qu'a poser les
// variables sur ce conteneur) et produit la palette du style Cytoscape.
//
// Chaque valeur est validee : une couleur illisible (format non gere,
// variable absente) ou une opacite hors [0, 1] retombe sur le defaut sur,
// jamais sur une valeur que le canvas interpreterait en noir.

export type SkyColor = `#${string}`;

export type SkyPalette = {
  bg: SkyColor;
  starByGroup: Record<EntityTypeGroup, SkyColor>;
  starDefault: SkyColor;
  haloOpacity: number;
  label: SkyColor;
  labelHalo: SkyColor;
  labelHaloOpacity: number;
  lineDeclared: SkyColor;
  lineDeclaredOpacity: number;
  // « Ponts » entre deux constellations (KAN-85) : opacite d'une relation
  // declaree qui relie deux communautes ; les liens du texte qui font pont
  // sont attenues dans la meme proportion.
  lineBridgeOpacity: number;
  lineText: SkyColor;
  lineTextOpacity: number;
  // Epaisseur des liens du texte (px du graphe) : ils restent tres en
  // retrait des relations declarees (retour de validation C2).
  lineTextWidth: number;
  lineLabel: SkyColor;
  accent: SkyColor;
  dimOpacity: number;
};

// Suffixe de jeton par groupe (sans accent ni majuscule).
export const GROUP_TOKEN: Record<EntityTypeGroup, string> = {
  Personnages: "personnages",
  Écologie: "ecologie",
  Lieux: "lieux",
  Organisation: "organisation",
  Magie: "magie",
  Lore: "lore",
  Objets: "objets",
  Divers: "divers",
};

// Defauts surs = valeurs livrees dans globals.css. Les 8 teintes d'etoile
// sont la palette categorique validee en C1 (scripts/validate_palette.js,
// mode dark), inchangee.
export const DEFAULT_SKY_PALETTE: SkyPalette = {
  bg: "#0f2333",
  starByGroup: {
    Personnages: "#3987e5",
    Écologie: "#008300",
    Lieux: "#d55181",
    Organisation: "#c98500",
    Magie: "#199e70",
    Lore: "#d95926",
    Objets: "#9085e9",
    Divers: "#e66767",
  },
  starDefault: "#a1a1aa",
  haloOpacity: 0.35,
  label: "#edf2f2",
  labelHalo: "#0f2333",
  labelHaloOpacity: 0.9,
  lineDeclared: "#c3cdea",
  lineDeclaredOpacity: 0.8,
  lineBridgeOpacity: 0.3,
  lineText: "#7d90b3",
  lineTextOpacity: 0.22,
  lineTextWidth: 0.75,
  lineLabel: "#edf2f2",
  accent: "#667ec7",
  dimOpacity: 0.22,
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i;

// Couleur CSS -> #rrggbb minuscule, ou null si le format n'est pas gere
// (oklch, nom de couleur, var() non resolue...). L'alpha eventuel est ignore :
// les opacites ont leurs propres jetons.
export function parseSkyColor(raw: string): SkyColor | null {
  const value = raw.trim();
  if (HEX.test(value)) {
    const hex = value.slice(1).toLowerCase();
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    return `#${full}`;
  }
  const match = RGB.exec(value);
  if (match) {
    const channels = [match[1], match[2], match[3]].map(Number);
    if (channels.every((c) => c <= 255)) {
      return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return null;
}

export function parseSkyOpacity(raw: string): number | null {
  const value = raw.trim();
  if (value === "") {
    return null;
  }
  const number = value.endsWith("%") ? Number(value.slice(0, -1)) / 100 : Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

// Epaisseur en px du graphe : nombre strictement positif, au plus 4.
export function parseSkyWidth(raw: string): number | null {
  const value = raw.trim().replace(/px$/, "");
  if (value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 4 ? number : null;
}

export function resolveSkyPalette(read: (token: string) => string): SkyPalette {
  const d = DEFAULT_SKY_PALETTE;
  const color = (token: string, fallback: SkyColor) => parseSkyColor(read(token)) ?? fallback;
  const opacity = (token: string, fallback: number) => parseSkyOpacity(read(token)) ?? fallback;

  const starByGroup = { ...d.starByGroup };
  for (const group of ENTITY_TYPE_GROUPS) {
    starByGroup[group] = color(`--sky-star-${GROUP_TOKEN[group]}`, d.starByGroup[group]);
  }
  return {
    bg: color("--sky-bg", d.bg),
    starByGroup,
    starDefault: color("--sky-star-default", d.starDefault),
    haloOpacity: opacity("--sky-halo-opacity", d.haloOpacity),
    label: color("--sky-label", d.label),
    labelHalo: color("--sky-label-halo", d.labelHalo),
    labelHaloOpacity: opacity("--sky-label-halo-opacity", d.labelHaloOpacity),
    lineDeclared: color("--sky-line-declared", d.lineDeclared),
    lineDeclaredOpacity: opacity("--sky-line-declared-opacity", d.lineDeclaredOpacity),
    lineBridgeOpacity: opacity("--sky-line-bridge-opacity", d.lineBridgeOpacity),
    lineText: color("--sky-line-text", d.lineText),
    lineTextOpacity: opacity("--sky-line-text-opacity", d.lineTextOpacity),
    lineTextWidth: parseSkyWidth(read("--sky-line-text-width")) ?? d.lineTextWidth,
    lineLabel: color("--sky-line-label", d.lineLabel),
    accent: color("--sky-accent", d.accent),
    dimOpacity: opacity("--sky-dim-opacity", d.dimOpacity),
  };
}

// Adaptateur navigateur : lecture des jetons sur l'element donne (le
// conteneur de la Constellation). Les variables CSS sont rendues avec leur
// var() resolu par getComputedStyle.
export function readSkyPalette(element: Element): SkyPalette {
  const style = getComputedStyle(element);
  return resolveSkyPalette((token) => style.getPropertyValue(token));
}

function isGroup(value: unknown): value is EntityTypeGroup {
  return typeof value === "string" && (ENTITY_TYPE_GROUPS as readonly string[]).includes(value);
}

export function starColor(palette: SkyPalette, group: unknown): SkyColor {
  return isGroup(group) ? palette.starByGroup[group] : palette.starDefault;
}

// --- Contraste (WCAG 2.x) -----------------------------------------------

function channels(color: SkyColor): [number, number, number] {
  const value = parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(color: SkyColor): number {
  const [r, g, b] = channels(color);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: SkyColor, b: SkyColor): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Couleur `top` posee avec l'opacite `alpha` sur `bottom` (composition
// normale, comme le canvas et le navigateur).
export function blend(top: SkyColor, bottom: SkyColor, alpha: number): SkyColor {
  const t = channels(top);
  const b = channels(bottom);
  const mix = (i: 0 | 1 | 2) => Math.round(t[i] * alpha + b[i] * (1 - alpha));
  return `#${[mix(0), mix(1), mix(2)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
