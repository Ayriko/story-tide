import type { Mailer, MailMessage } from "./types";

// Fake en memoire - tests unitaires des services qui dependent du port Mailer,
// et runs e2e (MAIL_TRANSPORT=memory) : un environnement de test ne doit jamais
// faire partir un message reel vers une adresse reelle.
export class MemoryMailerAdapter implements Mailer {
  private readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  // Reserve aux tests : inspecter ce qui a ete envoye sans transport reel.
  sent(): readonly MailMessage[] {
    return this.messages;
  }

  // Dernier message adresse a un destinataire donne (un flux de
  // reinitialisation peut en produire plusieurs a la suite).
  lastTo(address: string): MailMessage | undefined {
    for (let i = this.messages.length - 1; i >= 0; i -= 1) {
      const message = this.messages[i];
      if (message && message.to === address) {
        return message;
      }
    }
    return undefined;
  }
}
