import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const validSource = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  S3_ENDPOINT: "localhost",
  S3_PORT: "9000",
  S3_USE_SSL: "false",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY: "key",
  S3_SECRET_KEY: "secret",
  S3_BUCKET: "bucket",
  SMTP_HOST: "ssl0.ovh.net",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "admin@example.test",
  SMTP_PASSWORD: "secret",
  MAIL_FROM: "Story Tide <contact@example.test>",
};

describe("loadEnv", () => {
  it("accepte un jeu de variables valide et convertit les types", () => {
    const env = loadEnv(validSource);

    expect(env.S3_PORT).toBe(9000);
    expect(env.S3_USE_SSL).toBe(false);
    expect(env.DATABASE_URL).toBe(validSource.DATABASE_URL);
  });

  it("applique NODE_ENV=development par defaut si absent", () => {
    const env = loadEnv({ ...validSource, NODE_ENV: undefined });

    expect(env.NODE_ENV).toBe("development");
  });

  it("rejette une DATABASE_URL absente", () => {
    expect(() => loadEnv({ ...validSource, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it("rejette un BETTER_AUTH_SECRET trop court", () => {
    expect(() => loadEnv({ ...validSource, BETTER_AUTH_SECRET: "trop-court" })).toThrow();
  });

  it("rejette un S3_USE_SSL qui n'est ni 'true' ni 'false'", () => {
    expect(() => loadEnv({ ...validSource, S3_USE_SSL: "yes" })).toThrow();
  });

  it("rejette un S3_PORT non numerique", () => {
    expect(() => loadEnv({ ...validSource, S3_PORT: "not-a-port" })).toThrow();
  });

  it("accepte l'absence de COMMIT_SHA (optionnel)", () => {
    const env = loadEnv(validSource);

    expect(env.COMMIT_SHA).toBeUndefined();
  });

  it("accepte un COMMIT_SHA quand fourni", () => {
    const env = loadEnv({ ...validSource, COMMIT_SHA: "abc1234" });

    expect(env.COMMIT_SHA).toBe("abc1234");
  });

  it("convertit SMTP_PORT en nombre et SMTP_SECURE en booleen", () => {
    const env = loadEnv(validSource);

    expect(env.SMTP_PORT).toBe(465);
    expect(env.SMTP_SECURE).toBe(true);
  });

  it("applique MAIL_TRANSPORT=smtp par defaut", () => {
    // Defaut volontaire : un oubli de configuration doit echouer bruyamment a
    // l'envoi, jamais avaler silencieusement les messages (ADR-0025).
    const env = loadEnv(validSource);

    expect(env.MAIL_TRANSPORT).toBe("smtp");
  });

  it("accepte MAIL_TRANSPORT=memory (runs e2e)", () => {
    const env = loadEnv({ ...validSource, MAIL_TRANSPORT: "memory" });

    expect(env.MAIL_TRANSPORT).toBe("memory");
  });

  it("rejette un MAIL_TRANSPORT inconnu", () => {
    expect(() => loadEnv({ ...validSource, MAIL_TRANSPORT: "sendgrid" })).toThrow(/MAIL_TRANSPORT/);
  });

  it("rejette un SMTP_PASSWORD absent", () => {
    // Aucun defaut possible sur un secret : mieux vaut refuser de demarrer.
    expect(() => loadEnv({ ...validSource, SMTP_PASSWORD: undefined })).toThrow(/SMTP_PASSWORD/);
  });
});
