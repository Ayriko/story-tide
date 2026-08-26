import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/db/client";
import { env } from "@/env";
import { mailer } from "@/lib/mail";
import {
  buildResetPasswordMessage,
  RESET_LINK_VALIDITE_SECONDES,
} from "@/lib/mail/reset-password-email";

// Email + mot de passe uniquement (pas de verification d'adresse a
// l'inscription : le seul message envoye par le produit est celui de
// reinitialisation, KAN-52).
// Hash des mots de passe : scrypt (defaut Better Auth) - OWASP A02.
// Rate limiting : active par defaut par Better Auth - OWASP A04/A07.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // Duree de validite du jeton de reinitialisation. Egale au defaut de
    // Better Auth (3600 s), posee explicitement : la duree est annoncee a
    // l'utilisateur dans le message (RESET_LINK_VALIDITE_SECONDES), les deux
    // doivent rester alignees - un test le verrouille.
    resetPasswordTokenExpiresIn: RESET_LINK_VALIDITE_SECONDES,
    // Appele par Better Auth apres generation d'un jeton a usage unique.
    // `url` porte deja le jeton et la redirection ; on ne la reconstruit pas.
    // Un echec d'envoi est propage (l'action appelante le convertit en erreur
    // typee et logue la cause reelle) : l'utilisateur doit savoir qu'aucun
    // message n'est parti plutot que d'attendre un message fantome.
    sendResetPassword: async ({ user, url }) => {
      await mailer.send(buildResetPasswordMessage(user.email, url));
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // nextCookies() doit rester le dernier plugin : il fait poser les cookies de
  // session par les Server Actions qui appellent auth.api.* directement.
  plugins: [nextCookies()],
});

// Session courante cote serveur (RSC / Server Actions). Retourne null si non connecte.
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
