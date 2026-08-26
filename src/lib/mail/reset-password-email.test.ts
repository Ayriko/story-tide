import { describe, expect, it } from "vitest";
import { buildResetPasswordMessage, RESET_LINK_VALIDITE_SECONDES } from "./reset-password-email";

const URL_TEST =
  "https://storytide.fr/api/auth/reset-password/abc123?callbackURL=%2Freset-password";

describe("buildResetPasswordMessage", () => {
  it("adresse le message au destinataire demande", () => {
    const message = buildResetPasswordMessage("lectrice@example.com", URL_TEST);

    expect(message.to).toBe("lectrice@example.com");
    expect(message.subject).toContain("Réinitialisation");
  });

  it("place le lien de reinitialisation dans les deux versions du message", () => {
    const message = buildResetPasswordMessage("lectrice@example.com", URL_TEST);

    expect(message.text).toContain(URL_TEST);
    // Dans le HTML, le & de l'URL est echappe en &amp; - c'est la meme URL.
    expect(message.html).toContain('href="https://storytide.fr/api/auth/reset-password/abc123');
  });

  it("annonce la duree de validite reellement configuree cote Better Auth", () => {
    const message = buildResetPasswordMessage("lectrice@example.com", URL_TEST);

    // Verrou : si RESET_LINK_VALIDITE_SECONDES change, le message doit suivre,
    // sinon on annonce une duree fausse a l'utilisateur.
    expect(RESET_LINK_VALIDITE_SECONDES).toBe(3600);
    expect(message.text).toContain("valable 1 heure");
    expect(message.html).toContain("valable 1 heure");
  });

  it("indique quoi faire si la demande n'emane pas de l'utilisateur", () => {
    const message = buildResetPasswordMessage("lectrice@example.com", URL_TEST);

    expect(message.text).toContain("ignorez ce message");
    expect(message.html).toContain("ignorez ce message");
  });

  it("invite a choisir un nouveau mot de passe au lieu d'en transporter un", () => {
    const message = buildResetPasswordMessage("lectrice@example.com", URL_TEST);

    // Le flux ne genere aucun mot de passe temporaire : seul un lien a usage
    // unique circule. Aucune tournure du type "votre mot de passe est ...".
    expect(message.text).toContain("choisir un nouveau mot de passe");
    for (const tournure of ["mot de passe est", "voici votre", "mot de passe provisoire"]) {
      expect(message.text.toLowerCase()).not.toContain(tournure);
      expect(message.html.toLowerCase()).not.toContain(tournure);
    }
  });

  it("echappe le lien avant de l'injecter dans le HTML", () => {
    const message = buildResetPasswordMessage(
      "lectrice@example.com",
      'https://storytide.fr/reset?token="><script>alert(1)</script>',
    );

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    // Le guillemet fermant injecte ne doit pas pouvoir clore l'attribut href.
    expect(message.html).toContain("&quot;&gt;");
  });

  it("n'embarque aucune ressource distante (pas de pixel de suivi)", () => {
    const message = buildResetPasswordMessage("lectrice@example.com", URL_TEST);

    expect(message.html).not.toContain("<img");
    expect(message.html).not.toContain("http://");
    // Seul lien externe autorise : celui de reinitialisation lui-meme.
    const liens = message.html.match(/https:\/\/[^"' ]+/g) ?? [];
    expect(liens.every((lien) => lien.startsWith("https://storytide.fr"))).toBe(true);
  });
});
