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
