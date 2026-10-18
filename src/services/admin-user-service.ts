import { prisma } from "@/db/client";
import type { ListUsersQuery } from "@/lib/admin-schemas";
import { PlanSource, UserRole, WorldOrigin } from "@/generated/prisma/client";
import type { Prisma, UserPlan } from "@/generated/prisma/client";

// Gestion des comptes depuis /admin (KAN-72, ADR-0029) : liste, fiche,
// changement de plan et de role. Toute ecriture passe par une transaction qui
// pose la modification ET sa ligne de journal (AdminAuditLog) ensemble :
// jamais de changement sans trace, jamais de trace sans changement.
//
// AUTORISATION : l'appelant est verifie par requireAdmin() /
// requireAdminOrNotFound() (src/lib/auth-session.ts), qui relit le role en
// base a chaque appel. Ce service porte la regle metier qui depend de la
// cible : un administrateur ne retire pas son propre role.

// Constantes TS, pas d'enum SQL : la liste des actions va grandir (lot 2).
export const ADMIN_ACTION_PLAN_CHANGE = "plan.change";
export const ADMIN_ACTION_ROLE_CHANGE = "role.change";

export const USERS_PAGE_SIZE = 25;
export const SCRIPT_PROMOTION_REASON = "promotion par script";

export class AdminUserNotFoundError extends Error {
  constructor() {
    super("Compte introuvable.");
    this.name = "AdminUserNotFoundError";
  }
}

export class AdminNoChangeError extends Error {
  constructor() {
    super("Aucun changement : cette valeur est déjà en place.");
    this.name = "AdminNoChangeError";
  }
}

// Sans cette garde, le seul administrateur peut se verrouiller dehors : plus
// personne n'atteint /admin pour lui rendre son role (retour par psql).
export class AdminSelfDemotionError extends Error {
  constructor() {
    super("Vous ne pouvez pas retirer votre propre rôle d'administrateur.");
    this.name = "AdminSelfDemotionError";
  }
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  role: UserRole;
  plan: UserPlan;
  planSource: PlanSource;
  worlds: number;
  entities: number;
};

export type AdminUserPage = {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listUsers({ q, page }: ListUsersQuery): Promise<AdminUserPage> {
  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        role: true,
        plan: true,
        planSource: true,
        worlds: { select: { _count: { select: { entities: true } } } },
      },
    }),
  ]);

  return {
    users: users.map(({ worlds, ...user }) => ({
      ...user,
      worlds: worlds.length,
      entities: worlds.reduce((sum, world) => sum + world._count.entities, 0),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
  };
}

export type AdminAuditEntry = {
  id: string;
  actorLabel: string;
  action: string;
  before: string;
  after: string;
  reason: string;
  createdAt: Date;
};

export type AdminUserDetail = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: UserRole;
  plan: UserPlan;
  planSource: PlanSource;
  worldsTotal: number;
  worldsUser: number;
  entities: number;
  history: AdminAuditEntry[];
};

// before/after sont des objets JSON plats ({ plan, planSource } ou { role }) :
// rendus "plan : FREE, planSource : DEFAULT" pour l'historique. Toute autre
// forme (action future) retombe sur le JSON brut plutot que sur du vide.
function formatAuditValue(value: unknown): string {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.entries(value)
      .map(([key, entry]) => `${key} : ${String(entry)}`)
      .join(", ");
  }
  return JSON.stringify(value);
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      role: true,
      plan: true,
      planSource: true,
      worlds: { select: { origin: true, _count: { select: { entities: true } } } },
      adminHistory: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          before: true,
          after: true,
          reason: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!user) {
    throw new AdminUserNotFoundError();
  }

  const { worlds, adminHistory, ...identity } = user;
  return {
    ...identity,
    worldsTotal: worlds.length,
    worldsUser: worlds.filter((world) => world.origin === WorldOrigin.USER).length,
    entities: worlds.reduce((sum, world) => sum + world._count.entities, 0),
    history: adminHistory.map((entry) => ({
      id: entry.id,
      actorLabel: entry.actor.name.trim() || entry.actor.email,
      action: entry.action,
      before: formatAuditValue(entry.before),
      after: formatAuditValue(entry.after),
      reason: entry.reason,
      createdAt: entry.createdAt,
    })),
  };
}

// Plan pose a la main : planSource passe a MANUAL, prioritaire sur un futur
// abonnement (un renouvellement ne doit jamais ecraser un compte offert).
export async function changeUserPlan(
  actorId: string,
  targetUserId: string,
  plan: UserPlan,
  reason: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { plan: true, planSource: true },
    });
    if (!target) {
      throw new AdminUserNotFoundError();
    }
    if (target.plan === plan) {
      throw new AdminNoChangeError();
    }

    await tx.user.update({
      where: { id: targetUserId },
      data: { plan, planSource: PlanSource.MANUAL },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId,
        targetUserId,
        action: ADMIN_ACTION_PLAN_CHANGE,
        before: { plan: target.plan, planSource: target.planSource },
        after: { plan, planSource: PlanSource.MANUAL },
        reason,
      },
    });
  });
}

export async function changeUserRole(
  actorId: string,
  targetUserId: string,
  role: UserRole,
  reason: string,
): Promise<void> {
  if (actorId === targetUserId && role !== UserRole.ADMIN) {
    throw new AdminSelfDemotionError();
  }

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });
    if (!target) {
      throw new AdminUserNotFoundError();
    }
    if (target.role === role) {
      throw new AdminNoChangeError();
    }

    await tx.user.update({ where: { id: targetUserId }, data: { role } });
    await tx.adminAuditLog.create({
      data: {
        actorId,
        targetUserId,
        action: ADMIN_ACTION_ROLE_CHANGE,
        before: { role: target.role },
        after: { role },
        reason,
      },
    });
  });
}

// Premiere promotion, hors interface (scripts/admin-promote.ts) : personne
// n'est encore administrateur pour la faire depuis /admin. Auto-promotion
// tracee comme telle (acteur = cible). Deja ADMIN : rien n'est ecrit.
export async function promoteToAdmin(email: string): Promise<{ changed: boolean }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new AdminUserNotFoundError();
    }
    if (user.role === UserRole.ADMIN) {
      return { changed: false };
    }

    await tx.user.update({ where: { id: user.id }, data: { role: UserRole.ADMIN } });
    await tx.adminAuditLog.create({
      data: {
        actorId: user.id,
        targetUserId: user.id,
        action: ADMIN_ACTION_ROLE_CHANGE,
        before: { role: user.role },
        after: { role: UserRole.ADMIN },
        reason: SCRIPT_PROMOTION_REASON,
      },
    });
    return { changed: true };
  });
}
