/**
 * Story Tide — src/lib/linker/resolve-links.ts
 * ------------------------------------------------------------------
 * Résout une liste de `Match` bruts (sortie de `AhoCorasick.search`) en
 * cibles de liaison désirées, en appliquant les garde-fous de la spec §4.4 :
 * ambiguïté (homonymes sur les mêmes bornes), auto-mention, `LinkIgnore`.
 *
 * TypeScript pur, zéro dépendance (cf. aho-corasick.ts). Extrait de
 * `scanAndLinkEntity` (src/services/linker-service.ts) pour être PARTAGÉ
 * entre le worker (écrit les `Relation origin=AUTO`) et le surlignage live
 * côté client (affiche les mêmes occurrences dans l'éditeur) — garantissant
 * que ce qui est surligné est exactement ce qui devient une relation.
 */

import type { Match } from "./aho-corasick";

/** Une occurrence retenue (non ambiguë, non auto-mention, non ignorée). */
export interface ResolvedOccurrence {
  targetId: string;
  /** Bornes dans le texte scanné : [start, end) — indices UTF-16 (cf. Match). */
  start: number;
  end: number;
}

export interface ResolvedLinks {
  /** Ensemble des entités cibles désirées (dédupliqué, pour le diff de Relation). */
  targetIds: Set<string>;
  /** Occurrences individuelles retenues, avec positions (pour le surlignage). */
  occurrences: ResolvedOccurrence[];
}

export interface ResolveLinksOptions {
  /** Id de l'entité scannée : ses propres mentions d'elle-même sont exclues. */
  selfEntityId: string;
  /** Cibles ignorées via LinkIgnore pour cette entité source. */
  ignoredTargetIds: ReadonlySet<string>;
}

export function resolveLinks(matches: Match[], opts: ResolveLinksOptions): ResolvedLinks {
  // Regroupe par occurrence (mêmes bornes) : une occurrence matchée par
  // plusieurs entités distinctes est ambiguë (homonymes, spec §4.4 point 6) -
  // aucun lien silencieux n'est créé pour elle. Le marquage "ambigu" cliquable
  // pour trancher reste hors périmètre (backlog KAN-19, nécessite un modèle
  // de données dédié).
  const entityIdsByOccurrence = new Map<string, Set<string>>();
  const boundsByOccurrence = new Map<string, { start: number; end: number }>();
  for (const match of matches) {
    const key = `${match.start}-${match.end}`;
    const ids = entityIdsByOccurrence.get(key) ?? new Set<string>();
    ids.add(match.entityId);
    entityIdsByOccurrence.set(key, ids);
    boundsByOccurrence.set(key, { start: match.start, end: match.end });
  }

  const targetIds = new Set<string>();
  const occurrences: ResolvedOccurrence[] = [];

  for (const [key, occurrenceEntityIds] of entityIdsByOccurrence) {
    if (occurrenceEntityIds.size !== 1) {
      continue; // occurrence ambigue (homonymes) : pas de lien pour elle
    }
    // occurrenceEntityIds.size === 1 verifie juste au-dessus : un seul element.
    const targetId = [...occurrenceEntityIds][0] as string;
    if (targetId === opts.selfEntityId) {
      continue; // auto-mention exclue
    }
    if (opts.ignoredTargetIds.has(targetId)) {
      continue; // garde-fou LinkIgnore
    }
    targetIds.add(targetId);
    // key vient de boundsByOccurrence, renseigne pour chaque cle de
    // entityIdsByOccurrence dans la meme boucle ci-dessus : toujours present.
    const bounds = boundsByOccurrence.get(key) as { start: number; end: number };
    occurrences.push({ targetId, start: bounds.start, end: bounds.end });
  }

  return { targetIds, occurrences };
}
