import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth-schemas";

describe("registerSchema", () => {
  it("accepte des donnees valides et nettoie le nom/e-mail (trim)", () => {
    const result = registerSchema.parse({
      name: "  Aymeric  ",
      email: "  aymeric@example.com  ",
      password: "correcthorsebattery",
    });

    expect(result).toEqual({
      name: "Aymeric",
      email: "aymeric@example.com",
      password: "correcthorsebattery",
    });
  });

  it("rejette un nom vide", () => {
    const result = registerSchema.safeParse({
      name: "   ",
      email: "a@b.com",
      password: "12345678",
    });

    expect(result.success).toBe(false);
  });

  it("rejette un e-mail invalide", () => {
    const result = registerSchema.safeParse({
      name: "A",
      email: "pas-un-email",
      password: "12345678",
    });

    expect(result.success).toBe(false);
  });

  it("rejette un mot de passe trop court", () => {
    const result = registerSchema.safeParse({ name: "A", email: "a@b.com", password: "short" });

    expect(result.success).toBe(false);
  });

  it("rejette un mot de passe trop long", () => {
    const result = registerSchema.safeParse({
      name: "A",
      email: "a@b.com",
      password: "a".repeat(129),
    });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepte des donnees valides", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "whatever" });

    expect(result.success).toBe(true);
  });

  it("rejette un e-mail invalide", () => {
    const result = loginSchema.safeParse({ email: "pas-un-email", password: "whatever" });

    expect(result.success).toBe(false);
  });

  it("rejette un mot de passe vide", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });

    expect(result.success).toBe(false);
  });
});
