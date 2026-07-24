// Offre gratuite structurelle (KAN-18, spec §2.9, ADR-0014) : quotas
// mondes/entites, SANS Stripe (P2, hors perimetre). Un monde isIntroWorld=true
// (KAN-35, monde de demonstration clone a l'inscription) est hors quota sur
// les deux axes : jamais compte parmi FREE_WORLD_LIMIT mondes, jamais
// plafonne a FREE_ENTITY_LIMIT_PER_WORLD entites - voir
// world-service.ts/entity-service.ts.
export const FREE_WORLD_LIMIT = 3;
export const FREE_ENTITY_LIMIT_PER_WORLD = 50;
