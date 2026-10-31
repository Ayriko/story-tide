import { describe, expect, it } from "vitest";
import {
  BACKDROP_TILE,
  chartMaskSvg,
  farStarsMaskSvg,
  seedFromId,
  skyBackdrop,
  skyBackdropStyle,
  TICK_DEPTH,
  TICK_PERIOD,
  ticksMaskSvg,
} from "./sky-backdrop";

describe("seedFromId", () => {
  it("stable pour un meme id, differente pour deux id", () => {
    expect(seedFromId("cmvwd3xqc0000gwxfus52z7zi")).toBe(seedFromId("cmvwd3xqc0000gwxfus52z7zi"));
    expect(seedFromId("monde-a")).not.toBe(seedFromId("monde-b"));
    expect(seedFromId("")).toBe(0x811c9dc5);
  });
});

describe("skyBackdrop", () => {
  it("meme monde : meme ciel", () => {
    expect(skyBackdrop("monde-1")).toEqual(skyBackdrop("monde-1"));
  });

  it("deux mondes : deux ciels differents", () => {
    expect(skyBackdrop("monde-1").stars).not.toEqual(skyBackdrop("monde-2").stars);
  });

  it("etoiles lointaines dans la tuile, rayon et opacite bornes", () => {
    const { stars } = skyBackdrop("monde-1");
    expect(stars).toHaveLength(160);
    for (const star of stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(BACKDROP_TILE);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(BACKDROP_TILE);
      expect(star.r).toBeGreaterThanOrEqual(0.4);
      expect(star.r).toBeLessThanOrEqual(1.4);
      expect(star.o).toBeGreaterThanOrEqual(0.25);
      expect(star.o).toBeLessThanOrEqual(1);
    }
    // Discretion : une minorite seulement d'etoiles « nettes ».
    expect(stars.filter((star) => star.r > 1).length).toBeLessThan(stars.length / 4);
  });

  it("trois arcs dont le centre est hors champ (jamais un cercle entier)", () => {
    for (const id of ["monde-1", "monde-2", "x"]) {
      const { arcs } = skyBackdrop(id);
      expect(arcs).toHaveLength(3);
      for (const arc of arcs) {
        const outside = arc.cx < 0 || arc.cx > 1 || arc.cy < 0 || arc.cy > 1;
        expect(outside).toBe(true);
        expect(arc.r).toBeGreaterThanOrEqual(0.65);
        expect(arc.r).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("masques SVG", () => {
  it("semis : un cercle par etoile, dans une tuile fixe, opacite portee par l'etoile", () => {
    const stars = [{ x: 10, y: 20, r: 0.5, o: 0.3 }];
    expect(farStarsMaskSvg(stars)).toBe(
      "<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' fill='white'>" +
        "<circle cx='10' cy='20' r='0.5' fill-opacity='0.3'/></svg>",
    );
  });

  it("arcs en pourcentages (suivent la taille de la zone), trait de 1 px", () => {
    const svg = chartMaskSvg([{ cx: -0.25, cy: 1.5, r: 0.7 }]);
    expect(svg).toContain("<circle cx='-25%' cy='150%' r='70%'/>");
    expect(svg).toContain("stroke-width='1'");
    expect(svg).not.toContain("viewBox");
  });

  it("graduation : un trait long puis quatre courts par periode", () => {
    const svg = ticksMaskSvg("x");
    expect(svg.match(/<line /g)).toHaveLength(TICK_PERIOD / 12);
    expect(svg).toContain(`y2='${TICK_DEPTH}'`);
    expect(ticksMaskSvg("y")).toContain(`width='${TICK_DEPTH}' height='${TICK_PERIOD}'`);
  });

  it("graduation du bord de fin : les traits partent du bord (bas / droite)", () => {
    expect(ticksMaskSvg("x", "end")).toContain(
      `y1='${TICK_DEPTH - 4}' x2='12.5' y2='${TICK_DEPTH}'`,
    );
    expect(ticksMaskSvg("y", "end")).toContain(`<line x1='0' y1='0.5' x2='${TICK_DEPTH}'`);
  });

  it("variables CSS du monde : six masques en url() data:, deterministes", () => {
    const style = skyBackdropStyle("monde-1");
    expect(Object.keys(style)).toEqual([
      "--sky-stars-mask",
      "--sky-chart-mask",
      "--sky-ticks-top-mask",
      "--sky-ticks-bottom-mask",
      "--sky-ticks-left-mask",
      "--sky-ticks-right-mask",
    ]);
    for (const value of Object.values(style)) {
      expect(value).toMatch(/^url\("data:image\/svg\+xml,%3Csvg/);
    }
    expect(skyBackdropStyle("monde-1")).toEqual(style);
    expect(skyBackdropStyle("monde-2")["--sky-stars-mask"]).not.toBe(style["--sky-stars-mask"]);
  });
});
