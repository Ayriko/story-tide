import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/db/client";
import { env } from "@/env";

// Email + mot de passe uniquement (pas de SMTP au MVP -> pas de verification email).
// Hash des mots de passe : scrypt (defaut Better Auth) - OWASP A02.
// Rate limiting : active par defaut par Better Auth - OWASP A04/A07.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
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
