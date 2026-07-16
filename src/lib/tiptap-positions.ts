/**
 * Story Tide — src/lib/tiptap-positions.ts
 * ------------------------------------------------------------------
 * Remappe les positions caractère du `plainText` (tel qu'extrait par
 * `extractPlainText`, src/lib/tiptap-content.ts) vers des positions
 * ProseMirror, pour construire des décorations de surlignage dans
 * l'éditeur (spec §4.4, ADR-0001 : alignement caractère-exact non
 * négociable).
 *
 * `extractPlainText` = `generateText(content, extensions)` insère un
 * séparateur de bloc `"\n\n"` (2 caractères SYNTHÉTIQUES, sans existence
 * dans le document ProseMirror) à chaque frontière de node de bloc
 * rencontrée pendant le parcours (@tiptap/core `getTextBetween` :
 * `if (node.isBlock && pos > from) text += blockSeparator`). Ce n'est
 * donc PAS une simple translation d'offset constant entre `plainText`
 * et les positions ProseMirror.
 *
 * `buildTextWithPositions` reproduit EXACTEMENT le même parcours (même
 * séparateur, même condition `node.isBlock && pos > 0`) via
 * `doc.descendants`, qui visite les mêmes nœuds dans le même ordre que
 * `nodesBetween(0, doc.content.size, ...)` utilisé par `getTextBetween` -
 * pour que le texte produit soit identique caractère-à-caractère à
 * `extractPlainText`, tout en gardant la position ProseMirror de chaque
 * caractère "réel" (les caractères de séparateur n'ont pas de position
 * ProseMirror - `map` vaut `-1` pour eux).
 */

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const BLOCK_SEPARATOR = "\n\n";

export interface TextWithPositions {
  /** Identique à extractPlainText(doc.toJSON()) - même parcours, même séparateur. */
  text: string;
  /** map[i] = position ProseMirror du caractère text[i], ou -1 (séparateur synthétique). */
  map: number[];
}

export function buildTextWithPositions(doc: ProseMirrorNode): TextWithPositions {
  let text = "";
  const map: number[] = [];

  doc.descendants((node, pos) => {
    if (node.isBlock && pos > 0) {
      for (let i = 0; i < BLOCK_SEPARATOR.length; i++) {
        map.push(-1);
      }
      text += BLOCK_SEPARATOR;
    }
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        map.push(pos + i);
      }
      text += node.text;
    }
    return true;
  });

  return { text, map };
}

/**
 * Convertit une occurrence [start, end) du texte de `buildTextWithPositions`
 * en un intervalle ProseMirror [from, to). Retourne null si l'occurrence
 * chevauche un séparateur synthétique (ne devrait jamais arriver pour un
 * motif du dictionnaire - aucun nom/alias n'contient de saut de ligne -
 * mais on ne devine jamais une position invalide plutôt que de renvoyer
 * un intervalle incorrect).
 */
export function occurrenceToRange(
  map: number[],
  start: number,
  end: number,
): { from: number; to: number } | null {
  if (end <= start) {
    return null;
  }
  const from = map[start];
  const to = map[end - 1];
  if (from === undefined || from === -1 || to === undefined || to === -1) {
    return null;
  }
  return { from, to: to + 1 };
}
