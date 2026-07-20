import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("fusionne des classes statiques", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignore les valeurs falsy (conditions)", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("resout les conflits Tailwind en gardant la derniere classe", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
