import type { StylesheetJson } from "cytoscape";
import { ENTITY_TYPE_GROUPS } from "./entity-schemas";
import type { SkyColor, SkyPalette } from "./sky-theme";
import { STAR_TIERS, type BrightnessTier } from "./star-brightness";

// Feuille de style Cytoscape du ciel d'histoires (KAN-85, ADR-0033). Aucune
// couleur ni opacite en dur : tout vient de la palette resolue depuis les
// jetons CSS (sky-theme.ts) ; les tailles sont rassemblees ici (Cytoscape les
// attend en nombres, pixels du graphe avant zoom). Fonction pure : testee
// sans canvas.
//
// Aucune FONCTION dans la feuille : Cytoscape la reevaluerait a chaque
// recalcul de style d'un element, et l'eclairage au survol recalcule tout le
// ciel (mesure KAN-85 : survol divise par 4 a CPU x4). Groupes et paliers
// sont des listes FERMEES : un selecteur constant par valeur (jamais de
// valeur saisie par l'utilisateur dans un selecteur, skill
// cytoscape-selector-no-user-value).

export const SKY_SIZES = {
  labelFontSize: 10,
  labelMarginY: 5,
  labelOutlineWidth: 2,
  edgeLabelFontSize: 8,
  lineTextDash: [2, 5],
  lineDeclaredWidth: 1.25,
  // Lueur des lignes declarees (underlay de l'arete), allegee au retour de
  // validation C2.
  lineDeclaredGlowPadding: 1,
  lineDeclaredGlowOpacity: 0.07,
  arrowScale: 0.8,
  // Halo : rayon de la lueur autour du coeur = haloPadding x ce facteur ;
  // au survol, l'image s'agrandit (instantanement).
  glowRadiusFactor: 2,
  hoverGlowScale: 1.3,
  selectedBorder: 2,
  linkBorder: 3,
  handleSize: 12,
  handleBorder: 2,
  ghostDash: [6, 4],
  ghostWidth: 1.5,
} as const;

// Attenuation du ciel au survol (retour de validation C2) : entree lente en
// ease-out, retour plus rapide. Cytoscape applique la transition du style
// d'ARRIVEE : la duree d'entree est portee par .is-dimmed, celle du retour
// par le style de base. Seule l'OPACITE est en transition (chaque transition
// est une animation par element - profil KAN-85).
export const SKY_DIM_IN_MS = 300;
export const SKY_DIM_OUT_MS = 200;

export type SkyStylesheetOptions = {
  palette: SkyPalette;
  fontFamily: string;
  // prefers-reduced-motion : etat final directement, aucune transition.
  reducedMotion: boolean;
};

const TIERS: BrightnessTier[] = [0, 1, 2, 3];

// Diametre de l'image d'une etoile (coeur + lueur), px du graphe.
export function starGlowDiameter(tier: BrightnessTier): number {
  const { size, haloPadding } = STAR_TIERS[tier];
  return size + 2 * haloPadding * SKY_SIZES.glowRadiusFactor;
}

// Etoile en image SVG : un coeur plein puis une lueur en UN seul degrade
// radial qui s'eteint au bord (alpha reel - les degrades de Cytoscape n'ont
// pas d'alpha par arret, drawing-redraw.mjs). Aucun rayon.
export function starGlowSvg(color: SkyColor, tier: BrightnessTier, glowOpacity: number): string {
  const core = STAR_TIERS[tier].size / starGlowDiameter(tier);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const stops = [
    [0, 1],
    [core, 1],
    [round(core + 0.01), round(glowOpacity)],
    [round(core + (1 - core) * 0.4), round(glowOpacity * 0.35)],
    [1, 0],
  ]
    .map(
      ([offset, opacity]) =>
        `<stop offset='${offset}' stop-color='${color}' stop-opacity='${opacity}'/>`,
    )
    .join("");
  return (
    "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>" +
    `<defs><radialGradient id='g'>${stops}</radialGradient></defs>` +
    "<circle cx='64' cy='64' r='64' fill='url(#g)'/></svg>"
  );
}

function svgUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function tierHaloOpacity(palette: SkyPalette, tier: BrightnessTier): number {
  return palette.haloOpacity * STAR_TIERS[tier].haloShare;
}

export function buildSkyStylesheet({
  palette,
  fontFamily,
  reducedMotion,
}: SkyStylesheetOptions): StylesheetJson {
  const transitionOut = {
    "transition-property": "opacity",
    "transition-duration": reducedMotion ? 0 : SKY_DIM_OUT_MS,
    "transition-timing-function": "ease-out" as const,
  };
  const glow = (color: SkyColor, tier: BrightnessTier) =>
    svgUri(starGlowSvg(color, tier, tierHaloOpacity(palette, tier)));

  return [
    {
      selector: "node",
      style: {
        // L'etoile entiere (coeur + lueur) est l'image ; le disque du noeud
        // ne sert qu'a la cible du pointeur, au contour et aux aretes.
        "background-opacity": 0,
        "background-image": glow(palette.starDefault, 0),
        "background-clip": "none",
        "background-fit": "none",
        "background-width": starGlowDiameter(0),
        "background-height": starGlowDiameter(0),
        width: STAR_TIERS[0].size,
        height: STAR_TIERS[0].size,
        "bounds-expansion": (starGlowDiameter(0) - STAR_TIERS[0].size) / 2,
        "border-width": 0,
        // Nom : masque par defaut, affiche selon le niveau de detail
        // (sky-detail.ts : palier + zoom relatif), au survol (l'etoile et
        // ses voisins) et sur l'etoile selectionnee.
        label: "",
        "font-family": fontFamily,
        "font-size": SKY_SIZES.labelFontSize,
        color: palette.label,
        "text-valign": "bottom",
        "text-margin-y": SKY_SIZES.labelMarginY,
        // Contour du libelle : remplace l'ombre de texte (absente de
        // Cytoscape), lisibilite quel que soit le fond.
        "text-outline-color": palette.labelHalo,
        "text-outline-opacity": palette.labelHaloOpacity,
        "text-outline-width": SKY_SIZES.labelOutlineWidth,
        ...transitionOut,
      },
    },
    // Eclat par palier : taille du coeur, place du libelle et de la lueur.
    ...TIERS.map((tier) => {
      const { size, haloPadding } = STAR_TIERS[tier];
      const diameter = starGlowDiameter(tier);
      return {
        selector: `node[tier = ${tier}]`,
        style: {
          width: size,
          height: size,
          "background-width": diameter,
          "background-height": diameter,
          "bounds-expansion": (diameter * SKY_SIZES.hoverGlowScale - size) / 2,
          "text-margin-y": SKY_SIZES.labelMarginY + haloPadding / 2,
          "background-image": glow(palette.starDefault, tier),
        },
      };
    }),
    // Teinte par groupe ET palier : une image par couple (32 au plus).
    ...ENTITY_TYPE_GROUPS.flatMap((group) =>
      TIERS.map((tier) => ({
        selector: `node[group = "${group}"][tier = ${tier}]`,
        style: { "background-image": glow(palette.starByGroup[group], tier) },
      })),
    ),
    // Etoile survolee : lueur agrandie, instantanement.
    ...TIERS.map((tier) => ({
      selector: `node.is-hovered[tier = ${tier}]`,
      style: {
        "background-width": starGlowDiameter(tier) * SKY_SIZES.hoverGlowScale,
        "background-height": starGlowDiameter(tier) * SKY_SIZES.hoverGlowScale,
      },
    })),
    {
      selector:
        "node.is-named, node.is-hovered, node.is-lit, node.is-selected, node.link-source, node.link-target",
      style: { label: "data(label)" },
    },
    {
      selector: "node.is-hovered, node.is-selected",
      style: {
        "border-width": SKY_SIZES.selectedBorder,
        "border-color": palette.accent,
      },
    },
    {
      // Liaison en cours (edgehandles) ou boite « Nouvelle relation » ouverte.
      selector: "node.eh-source, node.eh-hover, node.eh-target, node.link-source, node.link-target",
      style: {
        "border-width": SKY_SIZES.linkBorder,
        "border-color": palette.accent,
      },
    },
    {
      // Lien du texte (AUTO/MANUAL) par defaut : fin, pointille, tres en
      // retrait des relations declarees (jetons d'opacite et d'epaisseur).
      selector: "edge",
      style: {
        width: palette.lineTextWidth,
        "line-color": palette.lineText,
        "line-opacity": palette.lineTextOpacity,
        "target-arrow-color": palette.lineText,
        "target-arrow-shape": "none",
        "arrow-scale": SKY_SIZES.arrowScale,
        "curve-style": "bezier",
        ...transitionOut,
      },
    },
    {
      // Fleche seulement si la paire a un sens unique (graph-elements.ts), et
      // seulement sur une relation declaree : sur les liens du texte, les
      // pointes formaient des « rayons » autour des etoiles (retour de
      // validation C2) ; leur sens reste lisible dans la liste et la fiche.
      selector: 'edge[?arrow][kind = "declared"]',
      style: { "target-arrow-shape": "triangle" },
    },
    {
      selector: 'edge[kind = "text"]',
      style: { "line-style": "dashed", "line-dash-pattern": [...SKY_SIZES.lineTextDash] },
    },
    {
      // Relation declaree : trait plein lumineux, fin, qui dessine la
      // constellation ; libelle cache sauf survol, selection ou zoom (petit
      // monde seulement, sky-detail.ts).
      selector: 'edge[kind = "declared"]',
      style: {
        width: SKY_SIZES.lineDeclaredWidth,
        "line-style": "solid",
        "line-color": palette.lineDeclared,
        "line-opacity": palette.lineDeclaredOpacity,
        "target-arrow-color": palette.lineDeclared,
        "underlay-color": palette.lineDeclared,
        "underlay-padding": SKY_SIZES.lineDeclaredGlowPadding,
        "underlay-opacity": SKY_SIZES.lineDeclaredGlowOpacity,
        label: "data(label)",
        "font-family": fontFamily,
        "font-size": SKY_SIZES.edgeLabelFontSize,
        "text-opacity": 0,
        color: palette.lineLabel,
        "text-outline-color": palette.labelHalo,
        "text-outline-opacity": palette.labelHaloOpacity,
        "text-outline-width": SKY_SIZES.labelOutlineWidth,
        "text-rotation": "autorotate",
      },
    },
    // « Ponts » entre deux constellations (KAN-85) : plus discrets que les
    // lignes internes, pour que chaque figure reste lisible ; sans lueur. Les
    // liens du texte qui font pont sont attenues dans la meme proportion.
    // Toujours eclaires au survol (edge.is-lit, plus bas).
    {
      selector: "edge.is-bridge",
      style: { "line-opacity": palette.lineBridgeOpacity, "underlay-opacity": 0 },
    },
    {
      selector: 'edge[kind = "text"].is-bridge',
      style: {
        "line-opacity":
          Math.round(
            ((palette.lineTextOpacity * palette.lineBridgeOpacity) /
              Math.max(palette.lineDeclaredOpacity, 0.01)) *
              1000,
          ) / 1000,
      },
    },
    {
      selector: "edge.is-label-visible, edge.is-zoomed-in, edge.is-selected-edge",
      style: { "text-opacity": 1 },
    },
    {
      // Constellation eclairee au survol : lignes de l'etoile pleinement
      // lumineuses.
      selector: "edge.is-lit",
      style: { "line-opacity": 1 },
    },
    {
      // Reste du ciel attenue pendant le survol d'une etoile : entree lente.
      selector: ".is-dimmed",
      style: {
        opacity: palette.dimOpacity,
        "transition-duration": reducedMotion ? 0 : SKY_DIM_IN_MS,
        "transition-timing-function": "ease-out",
      },
    },
    // Arrivee : etoiles et lignes eteintes jusqu'a leur paquet. Jamais par
    // `opacity` (en transition : un fondu par element) ni `visibility` (une
    // etoile cachee n'est plus cliquable) : chaque couche passe a 0, sans
    // transition - un paquet s'allume d'un coup, et un clic sur une etoile
    // encore eteinte la trouve.
    {
      selector: "node.is-unlit",
      style: {
        "background-image-opacity": 0,
        "border-opacity": 0,
        "text-opacity": 0,
      },
    },
    {
      selector: "edge.is-unlit",
      style: { "line-opacity": 0, "text-opacity": 0, "underlay-opacity": 0 },
    },
    {
      // Poignee de liaison : noeud technique, jamais une entree.
      selector: "node.link-handle",
      style: {
        label: "",
        width: SKY_SIZES.handleSize,
        height: SKY_SIZES.handleSize,
        "background-image": "none",
        "background-opacity": 1,
        "background-color": palette.bg,
        "border-width": SKY_SIZES.handleBorder,
        "border-color": palette.accent,
        "bounds-expansion": 0,
      },
    },
    {
      selector: "node.link-handle.is-dragging",
      style: { opacity: 0 },
    },
    {
      // Trace pendant la liaison (edgehandles) : pointilles accent, sans
      // fleche ni libelle ; l'arete reelle n'existe qu'apres la boite.
      selector: "edge.eh-ghost-edge",
      style: {
        width: SKY_SIZES.ghostWidth,
        "line-style": "dashed",
        "line-dash-pattern": [...SKY_SIZES.ghostDash],
        "line-color": palette.accent,
        "line-opacity": 1,
        "target-arrow-shape": "none",
        "underlay-opacity": 0,
        label: "",
      },
    },
    {
      selector: "edge.eh-preview",
      style: { display: "none" },
    },
    {
      selector: "node.eh-ghost-node",
      style: {
        opacity: 0,
        width: 1,
        height: 1,
        label: "",
        "background-image": "none",
        "bounds-expansion": 0,
      },
    },
  ];
}
