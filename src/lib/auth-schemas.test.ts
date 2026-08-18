import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, resetPasswordSchema } from "./auth-schemas";

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

describe("resetPasswordSchema", () => {
  it("accepte deux saisies identiques d'au moins 8 caracteres", () => {
    const resultat = resetPasswordSchema.safeParse({
      password: "nouveau-mot-de-passe",
      passwordConfirm: "nouveau-mot-de-passe",
    });

    expect(resultat.success).toBe(true);
  });

  it("rejette deux saisies differentes en pointant la confirmation", () => {
    const resultat = resetPasswordSchema.safeParse({
      password: "nouveau-mot-de-passe",
      passwordConfirm: "pas-le-meme-mot-de-passe",
    });

    expect(resultat.success).toBe(false);
    if (!resultat.success) {
      const probleme = resultat.error.issues[0];
      expect(probleme?.path).toEqual(["passwordConfirm"]);
      expect(probleme?.message).toBe("Les mots de passe ne correspondent pas.");
    }
  });

  it("applique les memes bornes de longueur qu'a l'inscription", () => {
    // Une regle plus laxiste ici serait un contournement de celle de registerSchema.
    expect(
      resetPasswordSchema.safeParse({ password: "court", passwordConfirm: "court" }).success,
    ).toBe(false);
    const trop_long = "x".repeat(129);
    expect(
      resetPasswordSchema.safeParse({ password: trop_long, passwordConfirm: trop_long }).success,
    ).toBe(false);
  });
});
