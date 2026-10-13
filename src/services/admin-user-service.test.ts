import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db/client";
import { PlanSource, UserPlan, UserRole, WorldOrigin } from "@/generated/prisma/client";
import { makeUser } from "@/test-utils/make-user";
import {
  ADMIN_ACTION_PLAN_CHANGE,
  ADMIN_ACTION_ROLE_CHANGE,
  AdminNoChangeError,
  AdminSelfDemotionError,
  AdminUserNotFoundError,
  SCRIPT_PROMOTION_REASON,
  changeUserPlan,
  changeUserRole,
  getUserDetail,
  listUsers,
  promoteToAdmin,
} from "./admin-user-service";

// Meme regle que world-service.test.ts : Prisma mocke, aucune connexion reelle.
vi.mock("@/db/client", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
  },
}));

const transaction = vi.mocked(prisma.$transaction);
const userCount = vi.mocked(prisma.user.count);
const userFindMany = vi.mocked(prisma.user.findMany);
const userFindUnique = vi.mocked(prisma.user.findUnique);
const userUpdate = vi.mocked(prisma.user.update);
const auditCreate = vi.mocked(prisma.adminAuditLog.create);

const ADMIN_ID = "admin-1";
const TARGET_ID = "user-2";

// Transaction interactive : le callback recoit le MEME client mocke, les
// ecritures faites "dans la transaction" se verifient donc sur les mocks
// habituels. Un callback qui leve fait echouer la transaction, comme en vrai.
beforeEach(() => {
  vi.resetAllMocks();
  transaction.mockImplementation(async (run) => run(prisma));
});

describe("changeUserPlan", () => {
  it("ecrit plan + planSource=MANUAL et la ligne de journal dans une seule transaction", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ id: TARGET_ID }));

    await changeUserPlan(ADMIN_ID, TARGET_ID, UserPlan.UNLIMITED, "compte offert a un ami");

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { plan: UserPlan.UNLIMITED, planSource: PlanSource.MANUAL },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorId: ADMIN_ID,
        targetUserId: TARGET_ID,
        action: ADMIN_ACTION_PLAN_CHANGE,
        before: { plan: UserPlan.FREE, planSource: PlanSource.DEFAULT },
        after: { plan: UserPlan.UNLIMITED, planSource: PlanSource.MANUAL },
        reason: "compte offert a un ami",
      },
    });
  });

  it("leve AdminUserNotFoundError pour un compte inconnu, sans rien ecrire", async () => {
    userFindUnique.mockResolvedValueOnce(null);

    await expect(
      changeUserPlan(ADMIN_ID, "inconnu", UserPlan.UNLIMITED, "compte offert"),
    ).rejects.toThrow(AdminUserNotFoundError);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("refuse un changement sans effet : pas de ligne de journal pour rien", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ id: TARGET_ID, plan: UserPlan.UNLIMITED }));

    await expect(
      changeUserPlan(ADMIN_ID, TARGET_ID, UserPlan.UNLIMITED, "compte offert"),
    ).rejects.toThrow(AdminNoChangeError);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("propage l'echec du journal : la transaction n'aboutit pas", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ id: TARGET_ID }));
    auditCreate.mockRejectedValueOnce(new Error("panne base"));

    await expect(
      changeUserPlan(ADMIN_ID, TARGET_ID, UserPlan.UNLIMITED, "compte offert"),
    ).rejects.toThrow("panne base");
  });
});

describe("changeUserRole", () => {
  it("ecrit le role et la ligne de journal dans une seule transaction", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ id: TARGET_ID }));

    await changeUserRole(ADMIN_ID, TARGET_ID, UserRole.ADMIN, "second administrateur");

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { role: UserRole.ADMIN },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorId: ADMIN_ID,
        targetUserId: TARGET_ID,
        action: ADMIN_ACTION_ROLE_CHANGE,
        before: { role: UserRole.USER },
        after: { role: UserRole.ADMIN },
        reason: "second administrateur",
      },
    });
  });

  it("refuse qu'un administrateur se retire son propre role, avant toute requete", async () => {
    await expect(changeUserRole(ADMIN_ID, ADMIN_ID, UserRole.USER, "je me retire")).rejects.toThrow(
      AdminSelfDemotionError,
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("laisse un administrateur en retrograder un autre", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ id: TARGET_ID, role: UserRole.ADMIN }));

    await changeUserRole(ADMIN_ID, TARGET_ID, UserRole.USER, "fin de mission");

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { role: UserRole.USER },
    });
  });

  it("refuse un changement sans effet", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ id: TARGET_ID }));

    await expect(
      changeUserRole(ADMIN_ID, TARGET_ID, UserRole.USER, "aucun changement"),
    ).rejects.toThrow(AdminNoChangeError);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("leve AdminUserNotFoundError pour un compte inconnu", async () => {
    userFindUnique.mockResolvedValueOnce(null);

    await expect(
      changeUserRole(ADMIN_ID, "inconnu", UserRole.ADMIN, "second administrateur"),
    ).rejects.toThrow(AdminUserNotFoundError);
  });
});

describe("promoteToAdmin", () => {
  it("passe le compte ADMIN et journalise une auto-promotion (acteur = cible)", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ id: TARGET_ID }));

    await expect(promoteToAdmin("aeliana@story-tide.test")).resolves.toEqual({ changed: true });

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { email: "aeliana@story-tide.test" },
      select: { id: true, role: true },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { role: UserRole.ADMIN },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorId: TARGET_ID,
        targetUserId: TARGET_ID,
        action: ADMIN_ACTION_ROLE_CHANGE,
        before: { role: UserRole.USER },
        after: { role: UserRole.ADMIN },
        reason: SCRIPT_PROMOTION_REASON,
      },
    });
  });

  it("refuse un e-mail inconnu", async () => {
    userFindUnique.mockResolvedValueOnce(null);

    await expect(promoteToAdmin("personne@story-tide.test")).rejects.toThrow(
      AdminUserNotFoundError,
    );
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("ne fait rien, et n'ecrit aucune ligne, si le compte est deja ADMIN", async () => {
    userFindUnique.mockResolvedValueOnce(makeUser({ id: TARGET_ID, role: UserRole.ADMIN }));

    await expect(promoteToAdmin("aeliana@story-tide.test")).resolves.toEqual({ changed: false });
    expect(userUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe("listUsers", () => {
  it("pagine par 25, du plus recent au plus ancien, sans filtre par defaut", async () => {
    userCount.mockResolvedValueOnce(60);
    userFindMany.mockResolvedValueOnce([]);

    const result = await listUsers({ q: "", page: 3 });

    expect(userCount).toHaveBeenCalledWith({ where: {} });
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: "desc" },
        skip: 50,
        take: 25,
      }),
    );
    expect(result).toMatchObject({ total: 60, page: 3, pageCount: 3 });
  });

  it("cherche dans l'e-mail OU le nom, sans tenir compte de la casse", async () => {
    userCount.mockResolvedValueOnce(0);
    userFindMany.mockResolvedValueOnce([]);

    const result = await listUsers({ q: "ael", page: 1 });

    const where = {
      OR: [
        { email: { contains: "ael", mode: "insensitive" } },
        { name: { contains: "ael", mode: "insensitive" } },
      ],
    };
    expect(userCount).toHaveBeenCalledWith({ where });
    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(result.pageCount).toBe(1);
  });

  it("additionne mondes et entrees de chaque compte", async () => {
    userCount.mockResolvedValueOnce(1);
    const account = {
      ...makeUser(),
      worlds: [{ _count: { entities: 25 } }, { _count: { entities: 7 } }],
    };
    userFindMany.mockResolvedValueOnce([account]);

    const { users } = await listUsers({ q: "", page: 1 });

    expect(users[0]).toMatchObject({ id: "user-1", worlds: 2, entities: 32 });
  });
});

describe("getUserDetail", () => {
  it("leve AdminUserNotFoundError pour un identifiant inconnu", async () => {
    userFindUnique.mockResolvedValueOnce(null);

    await expect(getUserDetail("inconnu")).rejects.toThrow(AdminUserNotFoundError);
  });

  it("rend compteurs et historique lisible, sans jamais selectionner le contenu des fiches", async () => {
    const account = {
      ...makeUser({ id: TARGET_ID, plan: UserPlan.UNLIMITED, planSource: PlanSource.MANUAL }),
      worlds: [
        { origin: WorldOrigin.INTRO, _count: { entities: 25 } },
        { origin: WorldOrigin.USER, _count: { entities: 4 } },
      ],
      adminHistory: [
        {
          id: "log-1",
          action: ADMIN_ACTION_PLAN_CHANGE,
          before: { plan: "FREE", planSource: "DEFAULT" },
          after: { plan: "UNLIMITED", planSource: "MANUAL" },
          reason: "compte offert",
          createdAt: new Date("2026-10-13T09:00:00.000Z"),
          actor: { name: " ", email: "admin@story-tide.test" },
        },
      ],
    };
    userFindUnique.mockResolvedValueOnce(account);

    const detail = await getUserDetail(TARGET_ID);

    expect(JSON.stringify(userFindUnique.mock.calls[0])).not.toMatch(/content|plainText/);
    expect(detail).toMatchObject({ worldsTotal: 2, worldsUser: 1, entities: 29 });
    expect(detail.history).toEqual([
      {
        id: "log-1",
        actorLabel: "admin@story-tide.test",
        action: ADMIN_ACTION_PLAN_CHANGE,
        before: "plan : FREE, planSource : DEFAULT",
        after: "plan : UNLIMITED, planSource : MANUAL",
        reason: "compte offert",
        createdAt: new Date("2026-10-13T09:00:00.000Z"),
      },
    ]);
  });
});
