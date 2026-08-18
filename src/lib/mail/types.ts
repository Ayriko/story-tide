export interface MailMessage {
  to: string;
  subject: string;
  // Toujours les deux formes : le texte brut est la version de repli des
  // clients qui n'affichent pas le HTML, et il pese dans le classement anti-spam.
  text: string;
  html: string;
}

// Port (ports & adapters) - les services ne connaissent que cette interface,
// jamais nodemailer directement (regle §4.2 du CLAUDE.md). Volontairement
// minimal : l'expediteur n'est pas un parametre de `send` mais une donnee de
// configuration de l'adaptateur (une seule adresse d'envoi pour tout le
// produit, MAIL_FROM) - un appelant ne peut donc pas usurper l'expediteur.
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
