import { describe, expect, it } from "vitest";
import { isWorldRootPath } from "./world-routes";

describe("isWorldRootPath", () => {
  it.each([["/worlds/eldoria"], ["/worlds/eldoria/"]])("%s : page racine du monde", (path) => {
    expect(isWorldRootPath(path, "eldoria")).toBe(true);
  });

  it.each([
    ["/worlds/eldoria/entities/e1"],
    ["/worlds/eldoria/settings"],
    ["/worlds/eldoria/settings/types"],
    ["/worlds/eldoria/graph"],
    ["/worlds/eldoria-bis"],
    ["/worlds/eldoriaa"],
    ["/worlds"],
    ["/worlds/autre"],
  ])("%s : pas la page racine (egalite exacte, jamais un prefixe)", (path) => {
    expect(isWorldRootPath(path, "eldoria")).toBe(false);
  });
});
