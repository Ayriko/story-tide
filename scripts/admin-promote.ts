// Promotion d'un compte existant au role ADMIN (KAN-72, ADR-0029), hors
// interface : personne n'est encore administrateur pour le faire depuis
// /admin. Usage (dev) :
//
//   npm run admin:promote -- <email>
//
// En production, pas de script dans le conteneur : les deux requetes SQL
// equivalentes sont dans docs/manuels/exploitation-vps.md §4.
import { prisma } from "@/db/client";
import { AdminUserNotFoundError, promoteToAdmin } from "@/services/admin-user-service";

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    throw new Error("Usage : npm run admin:promote -- <email d'un compte existant>");
  }

  try {
    const { changed } = await promoteToAdmin(email);
    console.log(
      changed
        ? `[admin] ${email} est maintenant ADMIN (ligne de journal écrite).`
        : `[admin] ${email} est déjà ADMIN, rien à faire.`,
    );
  } catch (error) {
    if (error instanceof AdminUserNotFoundError) {
      throw new Error(
        `Aucun compte pour l'e-mail ${email} - créer le compte via l'inscription d'abord.`,
        { cause: error },
      );
    }
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error("[admin] échec", error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
