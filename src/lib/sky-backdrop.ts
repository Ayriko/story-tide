import { mulberry32 } from "./prng";

// Fond « carte celeste » de la Constellation (KAN-85, ADR-0033) : semis
// d'etoiles lointaines et arcs de carte du ciel, DETERMINISTES par monde
// (graine derivee de l'id : le meme monde a toujours le meme ciel). Fonction
// pure ; le rendu passe par des masques SVG poses en variables CSS sur la
// zone du ciel et peints en ::before, sous le canvas (.sky-chart et
// .sky-far-stars, globals.css).
//
// Les etoiles lointaines vivent dans une TUILE fixe repetee (motif SVG) : un
// redimensionnement de la fenetre devoile simplement plus de tuile, sans
// recalcul ni saut ; une parallaxe future n'aura qu'a translater le motif.

export const BACKDROP_TILE = 1024;
const FAR_STAR_COUNT = 160;
const ARC_COUNT = 3;

export type FarStar = { x: number; y: number; r: number; o: number };
// Arc de carte du ciel : grand cercle dont on ne voit qu'une partie. Centre
// et rayon en fractions de la zone (unites % du SVG), le centre pouvant etre
// hors champ.
export type ChartArc = { cx: number; cy: number; r: number };
export type SkyBackdrop = { stars: FarStar[]; arcs: ChartArc[] };

// Hachage FNV-1a 32 bits d'une chaine : graine stable d'un id de monde.
export function seedFromId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function skyBackdrop(worldId: string): SkyBackdrop {
  const rng = mulberry32(seedFromId(worldId));
  const stars: FarStar[] = Array.from({ length: FAR_STAR_COUNT }, () => {
    // Majorite de tres petites etoiles, quelques-unes plus nettes.
    const size = rng() ** 3;
    return {
      x: round(rng() * BACKDROP_TILE, 1),
      y: round(rng() * BACKDROP_TILE, 1),
      r: round(0.4 + size * 1.0),
      o: round(0.25 + rng() * 0.75),
    };
  });
  const arcs: ChartArc[] = Array.from({ length: ARC_COUNT }, (_, index) => ({
    // Centres repartis autour de la zone (dessous, a gauche, a droite), hors
    // champ : seuls des arcs traversent l'ecran, jamais un cercle entier.
    cx: round(
      index === 0 ? 0.3 + rng() * 0.4 : index === 1 ? -0.35 + rng() * 0.15 : 1.2 + rng() * 0.15,
    ),
    cy: round(index === 0 ? 1.45 + rng() * 0.2 : 0.2 + rng() * 0.6),
    r: round(0.65 + rng() * 0.35),
  }));
  return { stars, arcs };
}

// --- Rendu en masques SVG -------------------------------------------------
// La couche est un ::before (skill fond-decoratif-pseudo-element : jamais de
// calque frere en absolu a cote d'une lib qui gere son propre DOM). Les SVG
// servent de MASQUES (blanc = visible) : la couleur et l'intensite restent
// des jetons CSS (--sky-far-star, --sky-chart...), lus par le navigateur,
// jamais copies dans l'image. Fonctions pures : rendues cote serveur, aucun
// calcul a l'hydratation.

const SVG_OPEN = "<svg xmlns='http://www.w3.org/2000/svg'";

function cssUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function farStarsMaskSvg(stars: readonly FarStar[]): string {
  const circles = stars
    .map((s) => `<circle cx='${s.x}' cy='${s.y}' r='${s.r}' fill-opacity='${s.o}'/>`)
    .join("");
  return `${SVG_OPEN} width='${BACKDROP_TILE}' height='${BACKDROP_TILE}' fill='white'>${circles}</svg>`;
}

// Arcs en unites % : ils suivent la taille de la zone sans recalcul ; trait
// de 1 px (le SVG n'a pas de viewBox, il n'est donc jamais mis a l'echelle).
export function chartMaskSvg(arcs: readonly ChartArc[]): string {
  const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;
  const circles = arcs
    .map((a) => `<circle cx='${pct(a.cx)}' cy='${pct(a.cy)}' r='${pct(a.r)}'/>`)
    .join("");
  return `${SVG_OPEN} width='100%' height='100%' fill='none' stroke='white' stroke-width='1'>${circles}</svg>`;
}

// Graduation des bords : un trait long tous les 60 px, un court tous les
// 12 px, repete le long de chaque bord.
export const TICK_PERIOD = 60;
export const TICK_DEPTH = 9;
// `edge` : bord de depart (haut / gauche) ou de fin (bas / droite) - les
// traits partent toujours du bord de la zone.
export function ticksMaskSvg(axis: "x" | "y", edge: "start" | "end" = "start"): string {
  const lines: string[] = [];
  for (let at = 0; at < TICK_PERIOD; at += 12) {
    const length = at === 0 ? TICK_DEPTH : 4;
    const [from, to] = edge === "start" ? [0, length] : [TICK_DEPTH - length, TICK_DEPTH];
    lines.push(
      axis === "x"
        ? `<line x1='${at + 0.5}' y1='${from}' x2='${at + 0.5}' y2='${to}'/>`
        : `<line x1='${from}' y1='${at + 0.5}' x2='${to}' y2='${at + 0.5}'/>`,
    );
  }
  const [w, h] = axis === "x" ? [TICK_PERIOD, TICK_DEPTH] : [TICK_DEPTH, TICK_PERIOD];
  return `${SVG_OPEN} width='${w}' height='${h}' stroke='white' stroke-width='1'>${lines.join("")}</svg>`;
}

// Variables CSS posees sur la zone de la Constellation ; globals.css
// (.sky-chart / .sky-far-stars) les consomme.
export function skyBackdropStyle(worldId: string): Record<`--${string}`, string> {
  const { stars, arcs } = skyBackdrop(worldId);
  return {
    "--sky-stars-mask": cssUrl(farStarsMaskSvg(stars)),
    "--sky-chart-mask": cssUrl(chartMaskSvg(arcs)),
    "--sky-ticks-top-mask": cssUrl(ticksMaskSvg("x", "start")),
    "--sky-ticks-bottom-mask": cssUrl(ticksMaskSvg("x", "end")),
    "--sky-ticks-left-mask": cssUrl(ticksMaskSvg("y", "start")),
    "--sky-ticks-right-mask": cssUrl(ticksMaskSvg("y", "end")),
  };
}
