import type { User } from "@/generated/prisma/client";
import { PlanSource, UserPlan, UserRole } from "@/generated/prisma/client";

// Factory de test : toujours un User COMPLET, meme quand la requete sous test
// n'en selectionne qu'un champ (skill prisma-mock-partial-select : jamais de
// litteral partiel ni de cast pour satisfaire le type du mock).
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Aeliana",
    email: "aeliana@story-tide.test",
    emailVerified: false,
    image: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    role: UserRole.USER,
    plan: UserPlan.FREE,
    planSource: PlanSource.DEFAULT,
    ...overrides,
  };
}
