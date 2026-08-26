import { describe, expect, it } from "vitest";
import { MemoryMailerAdapter } from "./memory-adapter";
import type { MailMessage } from "./types";

function message(to: string, subject = "Sujet"): MailMessage {
  return { to, subject, text: "texte", html: "<p>html</p>" };
}

describe("MemoryMailerAdapter", () => {
  it("conserve les messages envoyes dans l'ordre", async () => {
    const mailer = new MemoryMailerAdapter();

    await mailer.send(message("a@example.com", "Premier"));
    await mailer.send(message("b@example.com", "Second"));

    expect(mailer.sent().map((m) => m.subject)).toEqual(["Premier", "Second"]);
  });

  it("retrouve le dernier message adresse a un destinataire", async () => {
    const mailer = new MemoryMailerAdapter();

    await mailer.send(message("a@example.com", "Ancien"));
    await mailer.send(message("b@example.com", "Autre destinataire"));
    await mailer.send(message("a@example.com", "Recent"));

    expect(mailer.lastTo("a@example.com")?.subject).toBe("Recent");
  });

  it("renvoie undefined pour un destinataire jamais servi", async () => {
    const mailer = new MemoryMailerAdapter();

    await mailer.send(message("a@example.com"));

    expect(mailer.lastTo("inconnu@example.com")).toBeUndefined();
  });
});
