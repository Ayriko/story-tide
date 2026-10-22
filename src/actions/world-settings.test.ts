import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { WorldNotFoundError } from "@/services/world-service";
import {
  CustomTypeLabelTakenError,
  LastSelectableTypeError,
  ReassignMapStaleError,
  createCustomType,
  deleteCustomType,
  setNativeTypeHidden,
  updateCustomType,
} from "@/services/entity-type-service";
import {
  RelationReassignKindError,
  RelationTypeInUseError,
  RelationTypeLabelTakenError,
  createCustomRelationType,
  deleteCustomRelationType,
  setNativeRelationTypeHidden,
  updateCustomRelationType,
} from "@/services/relation-type-service";
import {
  createCustomRelationTypeAction,
  createCustomTypeAction,
  deleteCustomRelationTypeAction,
  deleteCustomTypeAction,
  setNativeRelationTypeHiddenAction,
  setNativeTypeHiddenAction,
  updateCustomRelationTypeAction,
  updateCustomTypeAction,
} from "./world-settings";

vi.mock("@/lib/auth-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// redirect() de Next leve pour interrompre le rendu : reproduit ici, sinon
// l'action continuerait apres la redirection.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/services/entity-type-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/entity-type-service")>();
  return {
    ...actual,
    createCustomType: vi.fn(),
    updateCustomType: vi.fn(),
    setNativeTypeHidden: vi.fn(),
    deleteCustomType: vi.fn(),
  };
});

// Types de relation (KAN-84) : services mockes, jamais la vraie base (skill
// nonfatal-catch-hides-missing-mock).
vi.mock("@/services/relation-type-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/relation-type-service")>();
  return {
    ...actual,
    createCustomRelationType: vi.fn(),
    updateCustomRelationType: vi.fn(),
    setNativeRelationTypeHidden: vi.fn(),
    deleteCustomRelationType: vi.fn(),
  };
});

const mockedRequireSession = vi.mocked(requireSession);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedCreateCustomType = vi.mocked(createCustomType);
const mockedUpdateCustomType = vi.mocked(updateCustomType);
const mockedSetNativeTypeHidden = vi.mocked(setNativeTypeHidden);
const mockedDeleteCustomType = vi.mocked(deleteCustomType);

const SESSION = { user: { id: "owner-1" } } as unknown as Awaited<
  ReturnType<typeof requireSession>
>;

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

const SHIP_FIELDS = { worldId: "w1", label: "Vaisseau", group: "Objets", icon: "ship" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCustomTypeAction", () => {
  it("cree le type pour le proprietaire de la session et revalide le layout du monde", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);

    const state = await createCustomTypeAction({}, formData(SHIP_FIELDS));

    expect(state).toEqual({ ok: true });
    expect(mockedCreateCustomType).toHaveBeenCalledWith("owner-1", "w1", {
      label: "Vaisseau",
      group: "Objets",
      icon: "ship",
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(app)/worlds/[slug]", "layout");
  });

  it("sans session : redirige vers /login sans appeler le service", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));

    await expect(createCustomTypeAction({}, formData(SHIP_FIELDS))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mockedRedirect).toHaveBeenCalledWith("/login");
    expect(mockedCreateCustomType).not.toHaveBeenCalled();
  });

  it("monde d'autrui : « introuvable », sans revalidation", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreateCustomType.mockRejectedValueOnce(new WorldNotFoundError());

    const state = await createCustomTypeAction({}, formData(SHIP_FIELDS));

    expect(state.formError).toBe("Type introuvable.");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("libelle deja utilise : erreur du champ libelle", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreateCustomType.mockRejectedValueOnce(new CustomTypeLabelTakenError());

    const state = await createCustomTypeAction({}, formData(SHIP_FIELDS));

    expect(state.errors?.label).toBe("Ce libellé est déjà utilisé dans ce monde.");
    expect(state.values?.label).toBe("Vaisseau");
  });

  it("validation Zod : libelle vide, groupe et icone inconnus, sans appeler le service", async () => {
    const state = await createCustomTypeAction(
      {},
      formData({ worldId: "w1", label: "  ", group: "Inconnu", icon: "dragon" }),
    );

    expect(state.errors).toEqual({
      label: "Le libellé est requis.",
      group: "Groupe invalide.",
      icon: "Icône invalide.",
    });
    expect(mockedRequireSession).not.toHaveBeenCalled();
    expect(mockedCreateCustomType).not.toHaveBeenCalled();
  });

  it("libelle de plus de 40 caracteres refuse", async () => {
    const state = await createCustomTypeAction(
      {},
      formData({ ...SHIP_FIELDS, label: "x".repeat(41) }),
    );
    expect(state.errors?.label).toBe("40 caractères maximum.");
  });

  it("echec inattendu : message generique ET erreur reelle loguee", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    const failure = new Error("connexion perdue");
    mockedCreateCustomType.mockRejectedValueOnce(failure);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await createCustomTypeAction({}, formData(SHIP_FIELDS));

    expect(state.formError).toBe("Enregistrement impossible pour le moment. Réessayez.");
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), failure);
    consoleError.mockRestore();
  });
});

describe("updateCustomTypeAction", () => {
  it("transmet worldId et typeId au service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);

    await updateCustomTypeAction({}, formData({ ...SHIP_FIELDS, typeId: "ct-ship" }));

    expect(mockedUpdateCustomType).toHaveBeenCalledWith(
      "owner-1",
      "w1",
      "ct-ship",
      expect.objectContaining({ label: "Vaisseau" }),
    );
  });
});

describe("setNativeTypeHiddenAction", () => {
  it("masque un type natif", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);

    const state = await setNativeTypeHiddenAction(
      {},
      formData({ worldId: "w1", type: "prophecy", hidden: "true" }),
    );

    expect(state).toEqual({ ok: true });
    expect(mockedSetNativeTypeHidden).toHaveBeenCalledWith("owner-1", "w1", "prophecy", true);
  });

  it("type inconnu refuse par Zod", async () => {
    const state = await setNativeTypeHiddenAction(
      {},
      formData({ worldId: "w1", type: "custom", hidden: "true" }),
    );
    expect(state.formError).toBe("Type invalide.");
    expect(mockedSetNativeTypeHidden).not.toHaveBeenCalled();
  });

  it("dernier type proposable : message du service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedSetNativeTypeHidden.mockRejectedValueOnce(new LastSelectableTypeError());

    const state = await setNativeTypeHiddenAction(
      {},
      formData({ worldId: "w1", type: "note", hidden: "true" }),
    );

    expect(state.formError).toBe("Au moins un type doit rester proposé dans ce monde.");
  });

  it("monde d'autrui : « introuvable »", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedSetNativeTypeHidden.mockRejectedValueOnce(new WorldNotFoundError());

    const state = await setNativeTypeHiddenAction(
      {},
      formData({ worldId: "w-autrui", type: "note", hidden: "true" }),
    );

    expect(state.formError).toBe("Monde introuvable.");
  });
});

describe("deleteCustomTypeAction", () => {
  it("lit la carte de reaffectation depuis les champs reassign:<entityId>", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);

    const state = await deleteCustomTypeAction(
      {},
      formData({
        worldId: "w1",
        typeId: "ct-ship",
        "reassign:e1": "object",
        "reassign:e2": "custom:ct-bag",
      }),
    );

    expect(state).toEqual({ ok: true });
    expect(mockedDeleteCustomType).toHaveBeenCalledWith("owner-1", "w1", "ct-ship", {
      e1: "object",
      e2: "custom:ct-bag",
    });
  });

  it("cible invalide : refus avant tout appel de service", async () => {
    const state = await deleteCustomTypeAction(
      {},
      formData({ worldId: "w1", typeId: "ct-ship", "reassign:e1": "" }),
    );
    expect(state.formError).toBe("Choisis un type cible pour chaque entrée.");
    expect(mockedDeleteCustomType).not.toHaveBeenCalled();
  });

  it("carte perimee : « La liste a changé, recharge »", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedDeleteCustomType.mockRejectedValueOnce(new ReassignMapStaleError());

    const state = await deleteCustomTypeAction({}, formData({ worldId: "w1", typeId: "ct-ship" }));

    expect(state.formError).toBe("La liste a changé, recharge la page.");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("monde d'autrui : « introuvable »", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedDeleteCustomType.mockRejectedValueOnce(new WorldNotFoundError());

    const state = await deleteCustomTypeAction(
      {},
      formData({ worldId: "w-autrui", typeId: "ct-ship" }),
    );

    expect(state.formError).toBe("Type introuvable.");
  });

  it("sans session : redirige vers /login", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));

    await expect(
      deleteCustomTypeAction({}, formData({ worldId: "w1", typeId: "ct-ship" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mockedDeleteCustomType).not.toHaveBeenCalled();
  });
});

describe("types de relation (KAN-84)", () => {
  const mockedCreate = vi.mocked(createCustomRelationType);
  const mockedUpdate = vi.mocked(updateCustomRelationType);
  const mockedSetHidden = vi.mocked(setNativeRelationTypeHidden);
  const mockedDelete = vi.mocked(deleteCustomRelationType);
  const SUZERAIN_FIELDS = {
    worldId: "w1",
    label: "Suzerain de",
    symmetric: "false",
    inverseLabel: "Vassal de",
  };

  it("cree un type dirige apres Zod et session, puis revalide le layout", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);

    const result = await createCustomRelationTypeAction({}, formData(SUZERAIN_FIELDS));

    expect(result).toEqual({ ok: true });
    expect(mockedCreate).toHaveBeenCalledWith("owner-1", "w1", {
      label: "Suzerain de",
      symmetric: false,
      inverseLabel: "Vassal de",
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(app)/worlds/[slug]", "layout");
  });

  it("sans session : redirige vers /login sans appeler le service", async () => {
    mockedRequireSession.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));

    await expect(createCustomRelationTypeAction({}, formData(SUZERAIN_FIELDS))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mockedRedirect).toHaveBeenCalledWith("/login");
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("monde d'autrui : « introuvable », sans revalidation", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreate.mockRejectedValueOnce(new WorldNotFoundError());

    const state = await createCustomRelationTypeAction({}, formData(SUZERAIN_FIELDS));

    expect(state.formError).toBe("Type introuvable.");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("dirige sans inverse : erreur de champ, ni session ni service", async () => {
    const result = await createCustomRelationTypeAction(
      {},
      formData({ ...SUZERAIN_FIELDS, inverseLabel: "" }),
    );

    expect(result.errors?.inverseLabel).toBe(
      "Le libellé inverse est requis pour une relation dirigée.",
    );
    expect(mockedRequireSession).not.toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("sens non choisi : erreur sur le champ sens", async () => {
    const result = await createCustomRelationTypeAction(
      {},
      formData({ worldId: "w1", label: "Pacte", inverseLabel: "" }),
    );
    expect(result.errors?.symmetric).toBeDefined();
  });

  it("libelle pris : erreur sur le champ signale par le service (inverse)", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedCreate.mockRejectedValueOnce(new RelationTypeLabelTakenError("inverseLabel"));

    const result = await createCustomRelationTypeAction({}, formData(SUZERAIN_FIELDS));

    expect(result.errors).toEqual({ inverseLabel: "Ce libellé est déjà utilisé dans ce monde." });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("changement de sens d'un type utilise : erreur sur le champ sens", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedUpdate.mockRejectedValueOnce(new RelationTypeInUseError());

    const result = await updateCustomRelationTypeAction(
      {},
      formData({ ...SUZERAIN_FIELDS, typeId: "rt1", symmetric: "true", inverseLabel: "" }),
    );

    expect(mockedUpdate).toHaveBeenCalledWith("owner-1", "w1", "rt1", {
      label: "Suzerain de",
      symmetric: true,
      inverseLabel: null,
    });
    expect(result.errors?.symmetric).toMatch(/son sens ne peut plus changer/);
  });

  it("panne inattendue : message generique et trace serveur", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    const failure = new Error("db down");
    mockedCreate.mockRejectedValueOnce(failure);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createCustomRelationTypeAction({}, formData(SUZERAIN_FIELDS));

    expect(result.formError).toBe("Enregistrement impossible pour le moment. Réessayez.");
    expect(consoleError).toHaveBeenCalledWith(
      "[world-settings] Création de type de relation échouée :",
      failure,
    );
    consoleError.mockRestore();
  });

  it("masque un type natif ; refuse une cle inconnue sans appeler le service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    await expect(
      setNativeRelationTypeHiddenAction(
        {},
        formData({ worldId: "w1", type: "rival", hidden: "true" }),
      ),
    ).resolves.toEqual({ ok: true });
    expect(mockedSetHidden).toHaveBeenCalledWith("owner-1", "w1", "rival", true);

    await expect(
      setNativeRelationTypeHiddenAction(
        {},
        formData({ worldId: "w1", type: "character", hidden: "true" }),
      ),
    ).resolves.toEqual({ formError: "Type invalide." });
    expect(mockedSetHidden).toHaveBeenCalledOnce();
  });

  it("supprime avec la carte de reaffectation postee en champs reassign:<id>", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);

    const result = await deleteCustomRelationTypeAction(
      {},
      formData({ worldId: "w1", typeId: "rt1", "reassign:r1": "leads", "reassign:r2": "leads" }),
    );

    expect(result).toEqual({ ok: true });
    expect(mockedDelete).toHaveBeenCalledWith("owner-1", "w1", "rt1", { r1: "leads", r2: "leads" });
  });

  it("reaffectation de nature differente : message du service", async () => {
    mockedRequireSession.mockResolvedValueOnce(SESSION);
    mockedDelete.mockRejectedValueOnce(new RelationReassignKindError());

    const result = await deleteCustomRelationTypeAction(
      {},
      formData({ worldId: "w1", typeId: "rt1", "reassign:r1": "ally" }),
    );

    expect(result).toEqual({
      formError: "Le type cible doit être de même nature (symétrique ou dirigée).",
    });
  });
});
