import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { AdminNotFoundError, requireAdmin } from "@/lib/auth-session";
import {
  AdminNoChangeError,
  AdminSelfDemotionError,
  AdminUserNotFoundError,
  changeUserPlan,
  changeUserRole,
} from "@/services/admin-user-service";
import { changeUserPlanAction, changeUserRoleAction } from "./admin";

// @/db/client mocke explicitement : auth-session et admin-user-service
// l'importent, aucun test de ce fichier ne doit pouvoir toucher une vraie base
// par un mock oublie (skill nonfatal-catch-hides-missing-mock).
vi.mock("@/db/client", () => ({ prisma: {} }));

vi.mock("@/lib/auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-session")>();
  return { ...actual, requireAdmin: vi.fn() };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/services/admin-user-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/admin-user-service")>();
  return { ...actual, changeUserPlan: vi.fn(), changeUserRole: vi.fn() };
});

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedChangeUserPlan = vi.mocked(changeUserPlan);
const mockedChangeUserRole = vi.mocked(changeUserRole);
const mockedRevalidatePath = vi.mocked(revalidatePath);

// Cast justifie : l'action ne lit que session.user.id, pas le type Better
// Auth complet (meme raison que folder.test.ts).
const ADMIN_SESSION = { user: { id: "admin-1" } } as unknown as Awaited<
  ReturnType<typeof requireAdmin>
>;

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

const VALID_PLAN = { userId: "user-2", plan: "UNLIMITED", reason: "compte offert" };
const VALID_ROLE = { userId: "user-2", role: "ADMIN", reason: "second administrateur" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("garde commune", () => {
  // requireAdmin leve la meme AdminNotFoundError pour un anonyme et pour un
  // compte standard (auth-session.test.ts) : l'action ne peut donc pas les
  // distinguer, et repond "Introuvable." quel que soit ce qui est envoye.
  it.each([
    ["changeUserPlanAction, formulaire valide", changeUserPlanAction, VALID_PLAN],
    ["changeUserPlanAction, formulaire vide", changeUserPlanAction, {}],
    ["changeUserRoleAction, formulaire valide", changeUserRoleAction, VALID_ROLE],
    ["changeUserRoleAction, formulaire vide", changeUserRoleAction, {}],
  ])("refuse un non-administrateur par « Introuvable. » (%s)", async (_label, action, fields) => {
    mockedRequireAdmin.mockRejectedValueOnce(new AdminNotFoundError());

    const result = await action({}, formData(fields));

    expect(result).toEqual({ formError: "Introuvable." });
    expect(mockedChangeUserPlan).not.toHaveBeenCalled();
    expect(mockedChangeUserRole).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("logue la cause reelle si la verification du role echoue (panne base)", async () => {
    const cause = new Error("panne base");
    mockedRequireAdmin.mockRejectedValueOnce(cause);

    const result = await changeUserPlanAction({}, formData(VALID_PLAN));

    expect(result).toEqual({ formError: "Action impossible pour le moment. Réessayez." });
    expect(console.error).toHaveBeenCalledWith("[admin] Vérification du rôle échouée :", cause);
  });
});

describe("changeUserPlanAction", () => {
  beforeEach(() => {
    mockedRequireAdmin.mockResolvedValue(ADMIN_SESSION);
  });

  it("change le plan au nom de l'administrateur connecte, revalide fiche et liste", async () => {
    const result = await changeUserPlanAction({}, formData(VALID_PLAN));

    expect(mockedChangeUserPlan).toHaveBeenCalledWith(
      "admin-1",
      "user-2",
      "UNLIMITED",
      "compte offert",
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/users/user-2");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/users");
    expect(result).toEqual({ success: "Plan passé à UNLIMITED." });
  });

  it("refuse une raison trop courte, sans appeler le service", async () => {
    const result = await changeUserPlanAction({}, formData({ ...VALID_PLAN, reason: "ami" }));

    expect(result).toEqual({
      errors: { reason: "La raison doit faire au moins 5 caractères." },
      values: { reason: "ami" },
    });
    expect(mockedChangeUserPlan).not.toHaveBeenCalled();
  });

  it("refuse un plan hors enum", async () => {
    const result = await changeUserPlanAction({}, formData({ ...VALID_PLAN, plan: "GOLD" }));

    expect(result.errors?.value).toBe("Plan inconnu.");
    expect(mockedChangeUserPlan).not.toHaveBeenCalled();
  });

  it.each([
    [new AdminUserNotFoundError(), "Compte introuvable."],
    [new AdminNoChangeError(), "Aucun changement : cette valeur est déjà en place."],
  ])("rend le message de l'erreur metier, sans la loguer (%s)", async (error, message) => {
    mockedChangeUserPlan.mockRejectedValueOnce(error);

    const result = await changeUserPlanAction({}, formData(VALID_PLAN));

    expect(result).toEqual({ formError: message, values: { reason: "compte offert" } });
    expect(console.error).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("logue la cause reelle d'une erreur inattendue et rend un message generique", async () => {
    const cause = new Error("panne base");
    mockedChangeUserPlan.mockRejectedValueOnce(cause);

    const result = await changeUserPlanAction({}, formData(VALID_PLAN));

    expect(result.formError).toBe("Modification impossible pour le moment. Réessayez.");
    expect(console.error).toHaveBeenCalledWith("[admin] Changement de plan échoué :", cause);
  });
});

describe("changeUserRoleAction", () => {
  beforeEach(() => {
    mockedRequireAdmin.mockResolvedValue(ADMIN_SESSION);
  });

  it("change le role et confirme", async () => {
    const result = await changeUserRoleAction({}, formData(VALID_ROLE));

    expect(mockedChangeUserRole).toHaveBeenCalledWith(
      "admin-1",
      "user-2",
      "ADMIN",
      "second administrateur",
    );
    expect(result).toEqual({ success: "Rôle passé à ADMIN." });
  });

  it("rend le refus d'auto-retrogradation leve par le service", async () => {
    mockedChangeUserRole.mockRejectedValueOnce(new AdminSelfDemotionError());

    const result = await changeUserRoleAction(
      {},
      formData({ userId: "admin-1", role: "USER", reason: "je me retire" }),
    );

    expect(result.formError).toBe("Vous ne pouvez pas retirer votre propre rôle d'administrateur.");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("refuse une raison trop courte et un role hors enum", async () => {
    const result = await changeUserRoleAction(
      {},
      formData({ userId: "user-2", role: "ROOT", reason: "non" }),
    );

    expect(result.errors).toEqual({
      value: "Rôle inconnu.",
      reason: "La raison doit faire au moins 5 caractères.",
    });
    expect(mockedChangeUserRole).not.toHaveBeenCalled();
  });
});
