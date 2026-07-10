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
