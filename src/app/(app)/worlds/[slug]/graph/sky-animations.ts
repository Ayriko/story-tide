import type {
  AnimationManipulation,
  Collection,
  Core,
  Css,
  EdgeSingular,
  NodeSingular,
  SingularAnimationOptionsPos,
  SingularElementArgument,
} from "cytoscape";
import { ARRIVAL_FADE_MS, ARRIVAL_TRACE_MS, arrivalSchedule } from "@/lib/sky-arrival";
import { SKY_SIZES } from "@/lib/sky-stylesheet";
import { starColor, type SkyPalette } from "@/lib/sky-theme";

// Animations signature du ciel (KAN-85, ADR-0033), appliquees a l'instance
// Cytoscape. Contraintes (vision visuelle) : on n'anime que l'opacite, la
// taille et des proprietes de trait (jamais une mise en page) ; rien ne
// bloque l'interaction ; prefers-reduced-motion = etat final directement.
// Le QUAND est calcule par sky-arrival.ts (pur, teste) ; ce module ne fait
// qu'appliquer.

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Proprietes posees en bypass le temps d'un trace, retirees ensuite (le
// style de la feuille reprend la main).
// La lueur (underlay) de la ligne suivrait tout le trace d'un coup : eteinte
// le temps du trace.
const TRACE_PROPS =
  "line-style line-dash-pattern line-dash-offset target-arrow-shape underlay-opacity";
const TRAIL_PROPS = "width line-color line-opacity";
// Eclat de la cible : un underlay pose le temps de l'eclat (les etoiles n'en
// ont pas - leur lueur est une image), a la couleur de l'etoile.
const FLASH_PROPS = "underlay-color underlay-shape underlay-opacity underlay-padding";
const FLASH_OPACITY = 0.6;
const TRAIL_WIDTH = 2.5;
const TRAIL_FADE_MS = 150;
const FLASH_UP_MS = 60;
const FLASH_DOWN_MS = 120;
const FLASH_EXTRA_PADDING = 6;

type Stoppable = { stop: () => void };

type StyleAnimation = {
  style: Record<string, number | string>;
  duration: number;
  easing: Css.TransitionTimingFunction;
};

// Animation de STYLE seule. Les types livres par cytoscape 3.34 exigent
// `position` ET `renderedPosition` (SingularAnimationOptionsBase, index.d.ts) ;
// le code les traite comme facultatifs (src/define/animation.mjs,
// animationImpl : seules les cles presentes sont animees) et la documentation
// montre `ele.animation({ style })`. Seule assertion du module, justifiee ici.
function styleAnimation(
  element: SingularElementArgument,
  options: StyleAnimation,
): AnimationManipulation {
  return element.animation(options as unknown as SingularAnimationOptionsPos);
}

// Trace d'une ligne : un tiret aussi long que l'arete, dont le decalage
// passe de L a 0 - la ligne se dessine depuis une extremite. `fromTarget`
// inverse le sens (decalage de -L a 0).
function traceEdge(
  edge: EdgeSingular,
  {
    fromTarget,
    durationMs,
    onDone,
  }: { fromTarget: boolean; durationMs: number; onDone?: () => void },
): Stoppable {
  const source = edge.sourceEndpoint();
  const target = edge.targetEndpoint();
  // Marge : une courbe de Bezier est un peu plus longue que la corde.
  const length = Math.max(1, Math.hypot(target.x - source.x, target.y - source.y) * 1.1 + 4);
  edge.style({
    "line-style": "dashed",
    "line-dash-pattern": [length, length],
    "line-dash-offset": fromTarget ? -length : length,
    "target-arrow-shape": "none",
    "underlay-opacity": 0,
  });
  edge.removeClass("is-unlit");
  const animation = styleAnimation(edge, {
    style: { "line-dash-offset": 0 },
    duration: durationMs,
    easing: "ease-out",
  });
  let stopped = false;
  const finish = () => {
    if (!stopped) {
      stopped = true;
      edge.removeStyle(TRACE_PROPS);
      onDone?.();
    }
  };
  animation
    .play()
    .promise("completed")
    .then(finish)
    .catch((error: unknown) => {
      // Une animation stoppee rejette rarement ; jamais avalee en silence.
      console.error("[sky] trace interrompu :", error);
      finish();
    });
  return {
    stop: () => {
      animation.stop();
      finish();
    },
  };
}

// --- a) Arrivee ------------------------------------------------------------

const ARRIVAL_START_MAX_WAIT_MS = 400;

function afterMountWork(start: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(start, { timeout: ARRIVAL_START_MAX_WAIT_MS });
    return () => window.cancelIdleCallback(handle);
  }
  const frame = requestAnimationFrame(start);
  return () => cancelAnimationFrame(frame);
}

export type ArrivalHandle = {
  running: () => boolean;
  // Etat final immediat (interaction, onglet cache, reduced-motion).
  finish: () => void;
};

export const NO_ARRIVAL: ArrivalHandle = { running: () => false, finish: () => {} };

// Les elements doivent avoir ete CREES avec la classe is-unlit (definitions
// de cytoscape()) : la poser apres coup declencherait la transition
// d'opacite 1 -> 0, un eclair du ciel plein avant l'arrivee.
export function playArrival(cy: Core, stars: Collection, edges: Collection): ArrivalHandle {
  const schedule = arrivalSchedule({
    stars: stars.nodes().map((node) => ({
      id: node.id(),
      tier: Number(node.data("tier")) || 0,
      // Une arete par paire : le degre = nombre de voisins distincts.
      brightness: node.degree(false),
    })),
    // Selecteurs CONSTANTS (aucune donnee utilisateur, skill
    // cytoscape-selector-no-user-value).
    declaredEdges: edges
      .edges('[kind = "declared"]')
      .map((edge) => ({ id: edge.id(), source: edge.source().id(), target: edge.target().id() })),
    textEdgeIds: edges.edges('[kind != "declared"]').map((edge) => edge.id()),
    reducedMotion: false,
  });
  if (schedule.totalMs === 0) {
    cy.batch(() => {
      stars.removeClass("is-unlit");
      edges.removeClass("is-unlit");
    });
    return NO_ARRIVAL;
  }

  const timers: ReturnType<typeof setTimeout>[] = [];
  const traces: Stoppable[] = [];
  let running = true;
  let cancelStart = () => {};

  const light = (ids: readonly string[]) =>
    cy.batch(() => {
      for (const id of ids) {
        cy.getElementById(id).removeClass("is-unlit");
      }
    });

  function finish() {
    if (!running) {
      return;
    }
    running = false;
    cancelStart();
    timers.forEach(clearTimeout);
    traces.forEach((trace) => trace.stop());
    cy.batch(() => {
      stars.removeClass("is-unlit");
      edges.removeClass("is-unlit");
    });
  }

  // Depart au premier moment libre du navigateur (au plus tard 400 ms) : le
  // calendrier ne commence pas pendant les taches qui suivent le montage
  // (fin d'hydratation, ~200 ms mesurees) - sinon ses premiers paquets
  // tomberaient dans une image gelee. Repli sans requestIdleCallback
  // (Safari) : apres la premiere image.
  cancelStart = afterMountWork(() => {
    for (const batch of schedule.starBatches) {
      timers.push(setTimeout(() => light(batch.ids), batch.atMs));
    }
    if (schedule.textEdges) {
      const { atMs, ids } = schedule.textEdges;
      timers.push(setTimeout(() => light(ids), atMs));
    }
    for (const batch of schedule.lineBatches) {
      timers.push(
        setTimeout(() => {
          cy.batch(() => {
            for (const id of batch.ids) {
              const edge = cy.getElementById(id);
              if (edge.nonempty() && edge.isEdge()) {
                traces.push(traceEdge(edge, { fromTarget: false, durationMs: ARRIVAL_TRACE_MS }));
              }
            }
          });
        }, batch.atMs),
      );
    }
    timers.push(setTimeout(finish, schedule.totalMs + ARRIVAL_FADE_MS));
  });

  return { running: () => running, finish };
}

// --- b) Eclairage d'une constellation au survol ------------------------------

// L'etoile, ses lignes et ses voisins directs restent pleinement lumineux ;
// le reste du ciel (etoiles et lignes du monde) s'attenue. Transitions de
// style (150 ms, 0 en reduced-motion) declarees dans la feuille.
//
// INCREMENTAL : en passant d'une etoile a une autre (sortie puis entree dans
// le meme mouvement), seule la difference des deux constellations change de
// classe - pas tout le ciel. La sortie vers le vide est reportee d'une image
// pour laisser une entree immediate en profiter.
export type ConstellationLight = {
  light: (node: NodeSingular) => void;
  scheduleClear: () => void;
  clear: () => void;
};

export function createConstellationLight(cy: Core, world: () => Collection): ConstellationLight {
  let lit: Collection | null = null;
  let frame = 0;

  function clear() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (lit === null) {
      return;
    }
    lit = null;
    cy.batch(() => {
      world().removeClass("is-dimmed is-lit");
    });
  }

  return {
    light(node) {
      cancelAnimationFrame(frame);
      frame = 0;
      const next = node.closedNeighborhood();
      const previous = lit;
      cy.batch(() => {
        if (previous === null) {
          world().difference(next).addClass("is-dimmed");
          // Noeuds compris : leurs noms s'affichent (sky-stylesheet.ts).
          next.addClass("is-lit");
          return;
        }
        const leaving = previous.difference(next);
        const entering = next.difference(previous);
        leaving.addClass("is-dimmed");
        leaving.removeClass("is-lit");
        entering.removeClass("is-dimmed");
        entering.addClass("is-lit");
      });
      lit = next;
    },
    scheduleClear() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(clear);
    },
    clear,
  };
}

// --- c) Trace a la creation d'une relation ----------------------------------

// La nouvelle ligne se dessine de `fromId` vers l'autre extremite, avec une
// trainee lumineuse (plus epaisse, couleur d'accent, qui revient au style de
// la ligne), puis la cible brille un instant.
export function traceNewRelation(
  edge: EdgeSingular,
  fromId: string,
  palette: SkyPalette,
): Stoppable {
  const fromTarget = edge.target().id() === fromId;
  const targetNode = fromTarget ? edge.source() : edge.target();
  let follow: Stoppable | null = null;

  edge.style({ width: TRAIL_WIDTH, "line-color": palette.accent, "line-opacity": 1 });
  const trace = traceEdge(edge, {
    fromTarget,
    durationMs: ARRIVAL_TRACE_MS,
    onDone: () => {
      follow = afterTrace(edge, targetNode, palette);
    },
  });
  return {
    stop: () => {
      trace.stop();
      follow?.stop();
      edge.removeStyle(TRAIL_PROPS);
      targetNode.removeStyle(FLASH_PROPS);
    },
  };
}

function afterTrace(edge: EdgeSingular, target: NodeSingular, palette: SkyPalette): Stoppable {
  const trail = styleAnimation(edge, {
    style: {
      width: SKY_SIZES.lineDeclaredWidth,
      "line-color": palette.lineDeclared,
      "line-opacity": palette.lineDeclaredOpacity,
    },
    duration: TRAIL_FADE_MS,
    easing: "ease-out",
  });
  trail
    .play()
    .promise("completed")
    .then(() => edge.removeStyle(TRAIL_PROPS))
    .catch((error: unknown) => console.error("[sky] trainee interrompue :", error));

  target.style({
    "underlay-color": starColor(palette, target.data("group")),
    "underlay-shape": "ellipse",
    "underlay-opacity": 0,
    "underlay-padding": 0,
  });
  const flash = styleAnimation(target, {
    style: {
      "underlay-opacity": FLASH_OPACITY,
      "underlay-padding": FLASH_EXTRA_PADDING,
    },
    duration: FLASH_UP_MS,
    easing: "ease-out",
  });
  let back: AnimationManipulation | null = null;
  flash
    .play()
    .promise("completed")
    .then(() => {
      back = styleAnimation(target, {
        style: { "underlay-opacity": 0, "underlay-padding": 0 },
        duration: FLASH_DOWN_MS,
        easing: "ease-in",
      });
      return back.play().promise("completed");
    })
    .then(() => target.removeStyle(FLASH_PROPS))
    .catch((error: unknown) => console.error("[sky] eclat interrompu :", error));

  return {
    stop: () => {
      trail.stop();
      flash.stop();
      back?.stop();
      edge.removeStyle(TRAIL_PROPS);
      target.removeStyle(FLASH_PROPS);
    },
  };
}
