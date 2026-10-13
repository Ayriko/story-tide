import type { UserPlan } from "@/generated/prisma/client";

// Offre gratuite structurelle (KAN-18, spec §2.9, ADR-0014) : quotas
// mondes/entites, SANS Stripe (P2, hors perimetre). Un monde origin=INTRO
// (KAN-35, monde de demonstration clone a l'inscription) ou origin=DEMO est
// hors quota sur les deux axes : jamais compte parmi FREE_WORLD_LIMIT mondes,
// jamais plafonne a FREE_ENTITY_LIMIT_PER_WORLD entites - voir
// world-service.ts/entity-service.ts.
export const FREE_WORLD_LIMIT = 3;
export const FREE_ENTITY_LIMIT_PER_WORLD = 50;

// null = pas de plafond sur cet axe.
export type PlanLimits = {
  worlds: number | null;
  entitiesPerWorld: number | null;
};

// Les quotas lisent le plan du proprietaire (KAN-72, ADR-0029), plus un
// palier code en dur. Record exhaustif : un palier ajoute a l'enum UserPlan
// sans limites declarees ici casse le typecheck.
const LIMITS_BY_PLAN: Record<UserPlan, PlanLimits> = {
  FREE: { worlds: FREE_WORLD_LIMIT, entitiesPerWorld: FREE_ENTITY_LIMIT_PER_WORLD },
  UNLIMITED: { worlds: null, entitiesPerWorld: null },
};

export function limitsForPlan(plan: UserPlan): PlanLimits {
  return LIMITS_BY_PLAN[plan];
}

// Seuil "proche du plafond" du tableau de bord d'administration : 80 % de la
// limite, arrondi au superieur (3 mondes sur 3, 40 entrees sur 50).
export const NEAR_LIMIT_RATIO = 0.8;

export function nearLimitThreshold(limit: number): number {
  return Math.ceil(limit * NEAR_LIMIT_RATIO);
}
