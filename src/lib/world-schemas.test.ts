import { describe, expect, it } from "vitest";
import { createWorldSchema } from "./world-schemas";

describe("createWorldSchema", () => {
  it("accepte un nom valide et le nettoie (trim)", () => {
    const result = createWorldSchema.parse({ name: "  Le Royaume des Sables  " });
    expect(result).toEqual({ name: "Le Royaume des Sables" });
  });

  it("rejette un nom vide", () => {
    const result = createWorldSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejette un nom trop long", () => {
    const result = createWorldSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepte un nom a la limite de longueur", () => {
    const result = createWorldSchema.safeParse({ name: "a".repeat(100) });
    expect(result.success).toBe(true);
  });
});
