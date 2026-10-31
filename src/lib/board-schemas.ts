import { z } from "zod";
import { MAX_ZOOM, MIN_ZOOM } from "./graph-layout";

// Frontiere des actions de disposition (KAN-87, ADR-0032) : nombres finis et
// bornes (une coordonnee absurde ne doit jamais atteindre la base), au plus
// 1 000 positions par appel.
export const MAX_COORDINATE = 1e6;
export const MAX_POSITIONS_PER_CALL = 1000;

const coordinate = z.number().finite().min(-MAX_COORDINATE).max(MAX_COORDINATE);

export const boardPositionsSchema = z
  .array(z.object({ entityId: z.string().min(1), x: coordinate, y: coordinate }))
  .max(MAX_POSITIONS_PER_CALL);

export const boardViewportSchema = z.object({
  zoom: z.number().finite().min(MIN_ZOOM).max(MAX_ZOOM),
  panX: coordinate,
  panY: coordinate,
});

export type BoardPosition = z.infer<typeof boardPositionsSchema>[number];
export type BoardViewport = z.infer<typeof boardViewportSchema>;
