"use server";

import type { ZodType } from "zod";
import { requireSession } from "@/lib/auth-session";
import { boardPositionsSchema, boardViewportSchema } from "@/lib/board-schemas";
import { replaceLayout, saveNodePositions, saveViewport } from "@/services/board-service";
import { EntityNotFoundError } from "@/services/entity-service";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";

// Disposition de la Constellation (KAN-87, ADR-0032), appelees directement
// depuis le graphe (hors <form>) : 1) Zod, 2) session, 3) appartenance du
// monde et des entrees verifiee dans le service (OWASP A01), 4) erreurs
// typees. AUCUN revalidatePath : une sauvegarde de position ne doit jamais
// provoquer de re-rendu serveur ni de recreation du graphe.

export type BoardActionResult = { ok: true } | { ok: false; error: string };

async function runBoardAction<T>(
  worldSlug: unknown,
  payload: unknown,
  schema: ZodType<T>,
  run: (ownerId: string, worldId: string, data: T) => Promise<void>,
  failureLog: string,
): Promise<BoardActionResult> {
  const parsed = schema.safeParse(payload);
  if (typeof worldSlug !== "string" || worldSlug.length === 0 || !parsed.success) {
    return { ok: false, error: "Disposition invalide." };
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, error: "Session expirée. Reconnectez-vous." };
  }

  try {
    const world = await getWorldBySlug(session.user.id, worldSlug);
    await run(session.user.id, world.id, parsed.data);
  } catch (error) {
    if (error instanceof WorldNotFoundError || error instanceof EntityNotFoundError) {
      return { ok: false, error: "Entrée introuvable." };
    }
    console.error(failureLog, error);
    return { ok: false, error: "Sauvegarde de la disposition impossible pour le moment." };
  }
  return { ok: true };
}

export async function saveNodePositionsAction(
  worldSlug: string,
  positions: unknown,
): Promise<BoardActionResult> {
  return runBoardAction(
    worldSlug,
    positions,
    boardPositionsSchema,
    saveNodePositions,
    "[board] Sauvegarde des positions échouée :",
  );
}

export async function saveViewportAction(
  worldSlug: string,
  viewport: unknown,
): Promise<BoardActionResult> {
  return runBoardAction(
    worldSlug,
    viewport,
    boardViewportSchema,
    saveViewport,
    "[board] Sauvegarde du cadrage échouée :",
  );
}

export async function replaceLayoutAction(
  worldSlug: string,
  positions: unknown,
): Promise<BoardActionResult> {
  return runBoardAction(
    worldSlug,
    positions,
    boardPositionsSchema,
    replaceLayout,
    "[board] Remplacement de la disposition échoué :",
  );
}
