import { describe, expect, it } from "vitest";
import { chooseCardPlacement, type Rect } from "./graph-card-placement";

const CONTAINER = { width: 1200, height: 800 };
const CARD = { width: 200, height: 100 };
// Etoile au centre, 24 px.
const ANCHOR: Rect = { x1: 588, y1: 388, x2: 612, y2: 412 };

function box(x: number, y: number, size = 20): Rect {
  return { x1: x - size / 2, y1: y - size / 2, x2: x + size / 2, y2: y + size / 2 };
}

describe("chooseCardPlacement", () => {
  it("rien autour : a droite de l'etoile, centree verticalement", () => {
    expect(
      chooseCardPlacement({ anchor: ANCHOR, card: CARD, container: CONTAINER, obstacles: [] }),
    ).toEqual({
      left: 624,
      top: 350,
      side: "right",
    });
  });

  it("voisine a droite (cas « b » / « c ») : la carte passe a gauche", () => {
    const placement = chooseCardPlacement({
      anchor: ANCHOR,
      card: CARD,
      container: CONTAINER,
      obstacles: [box(700, 410), box(680, 400)],
    });

    expect(placement.side).toBe("left");
  });

  it("voisines a droite et a gauche : dessus", () => {
    const placement = chooseCardPlacement({
      anchor: ANCHOR,
      card: CARD,
      container: CONTAINER,
      obstacles: [box(700, 400), box(500, 400)],
    });

    expect(placement.side).toBe("above");
  });

  it("trois cotes encombres : dessous", () => {
    const placement = chooseCardPlacement({
      anchor: ANCHOR,
      card: CARD,
      container: CONTAINER,
      obstacles: [box(700, 400), box(500, 400), box(600, 320)],
    });

    expect(placement.side).toBe("below");
  });

  it("partout encombre : le cote qui en masque le moins", () => {
    const placement = chooseCardPlacement({
      anchor: ANCHOR,
      card: CARD,
      container: CONTAINER,
      obstacles: [
        box(700, 400),
        box(720, 380),
        box(500, 400),
        box(600, 320),
        box(620, 330),
        box(600, 470),
      ],
    });

    expect(placement.side).toBe("left");
  });

  it("etoile au bord droit : la carte reste dans le conteneur sans couvrir l'etoile", () => {
    const anchor = { x1: 1170, y1: 388, x2: 1194, y2: 412 };
    const placement = chooseCardPlacement({
      anchor,
      card: CARD,
      container: CONTAINER,
      obstacles: [],
    });

    expect(placement.side).toBe("left");
    expect(placement.left + CARD.width).toBeLessThanOrEqual(anchor.x1);
  });

  it("bande haute reservee : la carte ne monte jamais dessous", () => {
    const anchor = { x1: 588, y1: 20, x2: 612, y2: 44 };
    const placement = chooseCardPlacement({
      anchor,
      card: CARD,
      container: CONTAINER,
      obstacles: [],
      topInset: 64,
    });

    expect(placement.top).toBeGreaterThanOrEqual(72);
  });
});
