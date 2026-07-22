import { prisma } from "@/db/client";
import { env } from "@/env";
import pkg from "../../../../package.json";

// Endpoint de sante public (supervision v1, C4.1.2) - interroge par une sonde
// externe (Better Stack). PUBLIC mais MINIMAL : le SHA de commit n'est
// renvoye QUE hors production (jamais sur storytide.fr), surface
// d'information reduite - coherent avec OWASP A05 (docs/securite-owasp.md).
// force-dynamic : jamais mis en cache, chaque appel refait la sonde base.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 2_000;

async function checkDb(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("Delai de sonde base de donnees depasse")),
      DB_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch (error) {
    // Repli generique : jamais d'erreur avalee (CLAUDE.md) - la cause reelle
    // (DSN, stack trace) part en log serveur, jamais dans la reponse HTTP.
    console.error("[health] Sonde base de données échouée :", error);
    return false;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };

  const dbOk = await checkDb();
  if (!dbOk) {
    return Response.json({ status: "degraded", checks: { db: "error" } }, { status: 503, headers });
  }

  const body: {
    status: "ok";
    version: string;
    uptime: number;
    checks: { db: "ok" };
    commit?: string;
  } = {
    status: "ok",
    version: pkg.version,
    uptime: Math.round(process.uptime()),
    checks: { db: "ok" },
  };

  if (env.NODE_ENV !== "production" && env.COMMIT_SHA) {
    body.commit = env.COMMIT_SHA;
  }

  return Response.json(body, { status: 200, headers });
}
