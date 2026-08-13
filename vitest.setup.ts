import "dotenv/config";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Sans `test.globals: true` (choix assume : imports explicites, coherent avec
// le TS strict du projet), Testing Library ne trouve pas de `afterEach` global
// et n'auto-nettoie pas le DOM entre tests - on le fait explicitement.
afterEach(() => {
  cleanup();
});

// jsdom n'implemente pas ResizeObserver - cmdk (Command, KAN-36) en instancie
// un dans CommandList pour mesurer sa hauteur (--cmdk-list-height), jamais
// exploite en test (pas de vrai layout sous jsdom). Polyfill no-op minimal,
// suffisant pour que le montage ne plante pas.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverPolyfill;

// jsdom n'implemente pas non plus Element.scrollIntoView - cmdk l'appelle
// pour garder l'option active visible pendant la navigation clavier
// (ArrowDown/ArrowUp), sans effet reel sous jsdom (pas de vrai scroll/layout).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom n'implemente pas IntersectionObserver - ScrollHint (KAN-45) en
// instancie un pour savoir si le pied de page est visible, jamais exploite
// en test (pas de vrai layout/scroll sous jsdom). Polyfill no-op minimal,
// meme principe que ResizeObserverPolyfill ci-dessus. Cast necessaire ici
// (contrairement a ResizeObserver) : l'interface IntersectionObserver exige
// aussi `root`/`rootMargin`/`thresholds`/`takeRecords()`, non pertinents
// pour un stub qui ne fait jamais reellement d'intersection sous jsdom.
class IntersectionObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver =
  IntersectionObserverPolyfill as unknown as typeof IntersectionObserver;
