import { env } from "@/env";
import { MemoryMailerAdapter } from "./memory-adapter";
import { SmtpMailerAdapter } from "./smtp-adapter";
import type { Mailer } from "./types";

// Composition root du port Mailer (meme forme que lib/storage/index.ts et
// lib/queue/index.ts). MAIL_TRANSPORT=memory est reserve aux environnements de
// test (.env.e2e) : un run automatise ne doit jamais faire partir un message
// reel. La valeur par defaut reste "smtp" - un oubli de configuration se voit
// donc a l'envoi, il ne se traduit jamais par un silence trompeur.
export const mailer: Mailer =
  env.MAIL_TRANSPORT === "memory"
    ? new MemoryMailerAdapter()
    : new SmtpMailerAdapter({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
        from: env.MAIL_FROM,
      });

export type { Mailer, MailMessage } from "./types";
