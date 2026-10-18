import { prisma } from "@/db/client";
import { ACTIVITY_DAYS, bucketActivity, type ActivityDay } from "@/lib/activity-buckets";
import { limitsForPlan, nearLimitThreshold } from "@/lib/quotas";
import { RelationOrigin, UserPlan, WorldOrigin } from "@/generated/prisma/client";

// Indicateurs du tableau de bord d'administration (KAN-72). Lecture seule,
// requetes agregees uniquement : aucun acces au contenu des fiches (jamais
// Entity.content ni Entity.plainText, les mondes sont prives).
//
// AUTORISATION : ces fonctions ne prennent pas d'identifiant d'appelant, elles
// ne sont appelees que derriere requireAdminOrNotFound() (src/lib/auth-session.ts).

const DAY_MS = 86_400_000;

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export type RecentUser = { id: string; email: string; name: string; createdAt: Date };

export type UserStats = {
  total: number;
  signedUpLast7Days: number;
  signedUpLast30Days: number;
  activeLast30Days: number;
  latest: RecentUser[];
};

// "Actif" = au moins une entree modifiee dans la periode, dans un monde
// origin=USER. Les mondes INTRO/DEMO sont exclus : le monde d'introduction
// clone a l'inscription date ses 25 entrees du jour de l'inscription, tout
// nouvel inscrit compterait comme actif sans avoir rien ecrit.
export async function getUserStats(now: Date = new Date()): Promise<UserStats> {
  const since30 = daysAgo(now, 30);
  const [total, signedUpLast7Days, signedUpLast30Days, activeLast30Days, latest] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: daysAgo(now, 7) } } }),
      prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      prisma.user.count({
        where: {
          worlds: {
            some: {
              origin: WorldOrigin.USER,
              entities: { some: { updatedAt: { gte: since30 } } },
            },
          },
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, email: true, name: true, createdAt: true },
      }),
    ]);

  return { total, signedUpLast7Days, signedUpLast30Days, activeLast30Days, latest };
}

export type ContentStats = {
  worldsTotal: number;
  worldsUser: number;
  entities: number;
  relationsAuto: number;
  relationsManual: number;
  linksIgnored: number;
  images: number;
  imagesBytes: number;
};

// Volume des images : somme de Image.size (metadonnee en base), pas le volume
// reellement occupe dans Silo (lot 2).
export async function getContentStats(): Promise<ContentStats> {
  const [
    worldsTotal,
    worldsUser,
    entities,
    relationsAuto,
    relationsManual,
    linksIgnored,
    images,
    imageSizes,
  ] = await Promise.all([
    prisma.world.count(),
    prisma.world.count({ where: { origin: WorldOrigin.USER } }),
    prisma.entity.count(),
    prisma.relation.count({ where: { origin: RelationOrigin.AUTO } }),
    prisma.relation.count({ where: { origin: RelationOrigin.MANUAL } }),
    prisma.linkIgnore.count(),
    prisma.image.count(),
    prisma.image.aggregate({ _sum: { size: true } }),
  ]);

  return {
    worldsTotal,
    worldsUser,
    entities,
    relationsAuto,
    relationsManual,
    linksIgnored,
    images,
    imagesBytes: imageSizes._sum.size ?? 0,
  };
}

// Entrees creees / modifiees par jour sur 30 jours, mondes origin=USER
// seulement (meme raison que getUserStats). Deux horodatages par entree, le
// decoupage par jour est fait par bucketActivity (src/lib).
export async function getActivitySeries(now: Date = new Date()): Promise<ActivityDay[]> {
  const rows = await prisma.entity.findMany({
    where: {
      world: { origin: WorldOrigin.USER },
      updatedAt: { gte: daysAgo(now, ACTIVITY_DAYS) },
    },
    select: { createdAt: true, updatedAt: true },
  });
  return bucketActivity(rows, now);
}

export type AccountNearLimit = {
  id: string;
  email: string;
  name: string;
  // Mondes origin=USER du compte, et entrees de son monde le plus rempli.
  worlds: number;
  fullestWorldEntities: number;
  worldLimit: number;
  entityLimit: number;
};

// Comptes FREE a 80 % ou plus d'un des deux plafonds. Seuls les mondes
// origin=USER comptent, sur les deux axes : INTRO et DEMO ne sont pas
// plafonnes (world-service.ts / entity-service.ts). Prisma ne filtre pas sur
// un compteur de relation : le seuil est applique ici, sur les compteurs
// remontes par la requete (aucune ligne de contenu chargee).
export async function getAccountsNearLimit(): Promise<AccountNearLimit[]> {
  const { worlds: worldLimit, entitiesPerWorld: entityLimit } = limitsForPlan(UserPlan.FREE);
  if (worldLimit === null || entityLimit === null) {
    return [];
  }

  const accounts = await prisma.user.findMany({
    where: { plan: UserPlan.FREE, worlds: { some: { origin: WorldOrigin.USER } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      worlds: {
        where: { origin: WorldOrigin.USER },
        select: { _count: { select: { entities: true } } },
      },
    },
  });

  const worldThreshold = nearLimitThreshold(worldLimit);
  const entityThreshold = nearLimitThreshold(entityLimit);

  return accounts
    .map((account) => ({
      id: account.id,
      email: account.email,
      name: account.name,
      worlds: account.worlds.length,
      fullestWorldEntities: Math.max(0, ...account.worlds.map((world) => world._count.entities)),
      worldLimit,
      entityLimit,
    }))
    .filter(
      (account) =>
        account.worlds >= worldThreshold || account.fullestWorldEntities >= entityThreshold,
    );
}
