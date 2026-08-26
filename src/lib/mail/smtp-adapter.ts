import nodemailer, { type Transporter } from "nodemailer";
import type { Mailer, MailMessage } from "./types";

export interface SmtpMailerConfig {
  host: string;
  port: number;
  // true = TLS immediat (port 465 chez OVH) ; false = connexion en clair
  // promue en TLS via STARTTLS (port 587).
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

// Wrapper fin autour du SDK nodemailer - exclu de la couverture au meme titre
// que s3-adapter.ts et pg-boss-adapter.ts (ADR-0007) : aucune logique metier
// ici, uniquement le branchement du transport. Le contenu des messages est
// construit par des fonctions pures testees (reset-password-email.ts).
export class SmtpMailerAdapter implements Mailer {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: SmtpMailerConfig) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });
    this.from = config.from;
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
