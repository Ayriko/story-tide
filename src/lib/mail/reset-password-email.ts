import type { MailMessage } from "./types";

// Duree de validite du lien, alignee sur `resetPasswordTokenExpiresIn` cote
// Better Auth (src/lib/auth.ts). Exportee pour que le test verrouille les deux
// ensemble : un message qui annonce une duree fausse est un bug de confiance.
export const RESET_LINK_VALIDITE_SECONDES = 3600;

const SUJET = "Réinitialisation de votre mot de passe Story Tide";

// Le lien vient de Better Auth (baseURL + token genere), jamais d'une saisie
// utilisateur - mais on l'echappe quand meme avant de l'injecter dans du HTML :
// une source "sure aujourd'hui" ne doit pas etre une hypothese de securite.
function escapeHtml(valeur: string): string {
  return valeur
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Contenu du message de reinitialisation. Fonction pure (aucun envoi, aucune
 * dependance) : c'est elle qui est testee, l'adaptateur SMTP ne fait que
 * transporter le resultat.
 *
 * Le message ne contient JAMAIS de mot de passe, ni l'ancien ni un nouveau
 * genere : il ne transporte qu'un lien a usage unique et a duree limitee.
 */
export function buildResetPasswordMessage(destinataire: string, url: string): MailMessage {
  const heures = RESET_LINK_VALIDITE_SECONDES / 3600;
  const validite = heures === 1 ? "1 heure" : `${heures} heures`;
  const lienEchappe = escapeHtml(url);

  const text = [
    "Vous avez demandé la réinitialisation de votre mot de passe Story Tide.",
    "",
    "Ouvrez ce lien pour choisir un nouveau mot de passe :",
    url,
    "",
    `Ce lien est valable ${validite} et ne peut servir qu'une seule fois.`,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message :",
    "votre mot de passe actuel reste inchangé.",
    "",
    "— Story Tide",
  ].join("\n");

  // HTML volontairement sobre et autonome : styles en ligne (les clients de
  // messagerie ignorent les feuilles de style), aucune image ni ressource
  // distante (pas de pixel de suivi, rien a bloquer), palette sombre de la
  // charte. Le lien est aussi ecrit en toutes lettres : un client qui n'affiche
  // pas le bouton laisse malgre tout l'adresse lisible et copiable.
  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#0f1115;color:#e6e6e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">
    <div style="max-width:520px;margin:0 auto;background:#171a21;border:1px solid #262b36;border-radius:12px;padding:28px;">
      <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#ffffff;">Story Tide</p>
      <p style="margin:0 0 16px;">Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p style="margin:0 0 24px;">
        <a href="${lienEchappe}" style="display:inline-block;padding:11px 20px;background:#c9a227;color:#1a1a1a;text-decoration:none;border-radius:8px;font-weight:600;">Choisir un nouveau mot de passe</a>
      </p>
      <p style="margin:0 0 16px;color:#a0a6b0;font-size:13px;">
        Ce lien est valable ${validite} et ne peut servir qu'une seule fois.
        Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br />
        <span style="color:#e6e6e6;word-break:break-all;">${lienEchappe}</span>
      </p>
      <p style="margin:0;color:#a0a6b0;font-size:13px;">
        Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste inchangé.
      </p>
    </div>
  </body>
</html>`;

  return { to: destinataire, subject: SUJET, text, html };
}
