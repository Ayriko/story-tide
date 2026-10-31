// Monde de test de performance de la Constellation (KAN-85) : « Ciel de
// test · 300 » pour un compte EXISTANT, recree a l'identique a chaque
// lancement. Invocation (meme patron que admin:promote) :
//   npm run seed:perf -- <email>
//
// Garde : refus net si NODE_ENV=production ou si la base n'est pas locale,
// AVANT toute requete (src/lib/dev-script-guard.ts).
import { prisma } from "@/db/client";
import { assertLocalDevDatabase } from "@/lib/dev-script-guard";
import { seedPerfWorld } from "@/services/perf-world-service";

async function main(): Promise<void> {
  assertLocalDevDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  });

  const email = process.argv[2];
  if (!email) {
    throw new Error("Usage : npm run seed:perf -- <email d'un compte existant>");
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error(
      `Aucun compte pour l'e-mail ${email} - creer le compte via l'inscription d'abord.`,
    );
  }

  const startedAt = Date.now();
  const summary = await seedPerfWorld(user.id);
  console.log(
    `[seed:perf] monde ${summary.worldId} : ${summary.entities} entrees, ` +
      `${summary.textLinks} liens du texte, ${summary.declared} relations declarees ` +
      `(${Date.now() - startedAt} ms).`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error("[seed:perf] echec", error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
