// CLI de seed du monde d'introduction "Atheraus" (KAN-35).
// Invocation (meme patron que `npm run worker`, Node 24 --env-file) :
//   node --env-file=.env --import tsx prisma/seed/run.ts --owner-email=<email>
//
// Resout l'ownerId a partir d'un compte EXISTANT (cree au prealable via
// l'inscription reelle, jamais une ligne User fabriquee a la main - Better
// Auth gere seul la creation de compte) puis delegue tout le travail a
// seedIntroWorld (src/services/intro-world-service.ts), la meme fonction que
// celle branchee sur l'inscription (KAN-35, cf. registerAction).
import { prisma } from "@/db/client";
import { jobQueue } from "@/lib/queue";
import { seedIntroWorld } from "@/services/intro-world-service";

function parseOwnerEmail(): string {
  const arg = process.argv.find((a) => a.startsWith("--owner-email="));
  const email = arg?.slice("--owner-email=".length);
  if (!email) {
    throw new Error("Usage : --owner-email=<email d'un compte existant>");
  }
  return email;
}

async function main(): Promise<void> {
  const email = parseOwnerEmail();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new Error(
      `Aucun compte pour l'e-mail ${email} - creer le compte via l'inscription d'abord.`,
    );
  }

  const startedAt = Date.now();
  const { worldId } = await seedIntroWorld(user.id);
  const elapsedMs = Date.now() - startedAt;

  console.log(`[seed] monde Atheraus (worldId=${worldId}) pret pour ${email}.`);
  console.log(`[seed] duree seedIntroWorld : ${elapsedMs} ms`);
}

main()
  .then(async () => {
    await jobQueue.stop().catch(() => {});
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error("[seed] echec", error);
    await jobQueue.stop().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
