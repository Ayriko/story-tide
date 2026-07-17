/**
 * Story Tide — src/lib/tiptap-link-highlight.ts
 * ------------------------------------------------------------------
 * Surlignage LIVE des mentions d'entités dans l'éditeur (spec §4.4) :
 * décorations ProseMirror (jamais un mark persisté - aucun impact sur le
 * schéma partagé serveur/client, cf. tiptap-content.ts / OWASP A03).
 *
 * Réutilise le moteur `AhoCorasick` (zéro dépendance, déjà 100 % testé)
 * et `resolveLinks` (mêmes garde-fous que le worker : ambiguïté,
 * auto-mention, LinkIgnore - src/services/linker-service.ts) pour que ce
 * qui est surligné soit exactement ce qui devient une Relation. Les
 * positions [start,end) du scan (sur `plainText`) sont remappées vers des
 * positions ProseMirror via `buildTextWithPositions`/`occurrenceToRange`
 * (src/lib/tiptap-positions.ts).
 *
 * La logique pure (calcul des décorations) est séparée du wiring Tiptap
 * (`createLinkHighlightExtension`) pour être testée directement contre un
 * `EditorState` réel, sans DOM/EditorView.
 */

import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { AhoCorasick, type Pattern } from "./linker/aho-corasick";
import { resolveLinks } from "./linker/resolve-links";
import { MENTION_CLASS_NAME, MENTION_TARGET_ATTR } from "./tiptap-mention-attrs";
import { buildTextWithPositions, occurrenceToRange } from "./tiptap-positions";

export { MENTION_CLASS_NAME, MENTION_TARGET_ATTR } from "./tiptap-mention-attrs";

export interface MentionHighlightConfig {
  /** Dictionnaire du monde (noms + alias), cf. buildDictionary. */
  dictionary: Pattern[];
  /** Entité de la fiche en cours d'édition : ses propres mentions d'elle-même sont exclues. */
  selfEntityId: string;
  /** Cibles ignorées via LinkIgnore pour cette entité. */
  ignoredTargetIds: readonly string[];
}

export const mentionHighlightPluginKey = new PluginKey<DecorationSet>("entity-mention-highlight");

function computeMentionDecorations(
  doc: ProseMirrorNode,
  automaton: AhoCorasick,
  selfEntityId: string,
  ignoredTargetIds: ReadonlySet<string>,
): DecorationSet {
  const { text, map } = buildTextWithPositions(doc);
  const matches = automaton.search(text);
  const { occurrences } = resolveLinks(matches, { selfEntityId, ignoredTargetIds });

  const decorations = occurrences.flatMap((occurrence) => {
    const range = occurrenceToRange(map, occurrence.start, occurrence.end);
    if (range === null) {
      return [];
    }
    return [
      // targetId duplique dans `attrs` (attribut DOM reel, lu par le
      // gestionnaire Ctrl/Cmd+clic sur l'element rendu) et dans `spec` (seule
      // partie publique typee de Decoration, utile pour l'inspection en test
      // sans caster sur le champ prive `type`).
      Decoration.inline(
        range.from,
        range.to,
        { class: MENTION_CLASS_NAME, [MENTION_TARGET_ATTR]: occurrence.targetId },
        { targetId: occurrence.targetId },
      ),
    ];
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Plugin ProseMirror pur (sans le wrapper Extension Tiptap), pour pouvoir
 * être testé contre un vrai `EditorState` sans DOM/EditorView - voir
 * tiptap-link-highlight.test.ts.
 *
 * L'automate est construit UNE SEULE FOIS, à la création du plugin (le
 * dictionnaire est figé au montage de l'éditeur - fabrique
 * createEditorExtensions/EntityEditor, même règle StrictMode que le reste
 * de l'éditeur). Seul le texte est re-scanné à chaque transaction qui
 * modifie le document : le test de passage à l'échelle de
 * aho-corasick.ts (~15 ms pour 100 000 caractères) prouve que ce re-scan
 * reste largement dans le budget perf, même à chaque frappe.
 */
export function createMentionHighlightPlugin(
  config: MentionHighlightConfig,
): Plugin<DecorationSet> {
  const automaton = new AhoCorasick(config.dictionary);
  const ignoredTargetIds = new Set(config.ignoredTargetIds);

  return new Plugin<DecorationSet>({
    key: mentionHighlightPluginKey,
    state: {
      init(_, instanceState) {
        return computeMentionDecorations(
          instanceState.doc,
          automaton,
          config.selfEntityId,
          ignoredTargetIds,
        );
      },
      apply(tr, oldSet) {
        if (!tr.docChanged) {
          // Deplace les decorations existantes le long de la transaction
          // (deplacement du curseur, changement de selection...) plutot que
          // de tout recalculer - evite un re-scan a chaque frappe qui ne
          // change pas le texte (ex. selection au clavier).
          return oldSet.map(tr.mapping, tr.doc);
        }
        return computeMentionDecorations(tr.doc, automaton, config.selfEntityId, ignoredTargetIds);
      },
    },
    props: {
      decorations(state) {
        return mentionHighlightPluginKey.getState(state);
      },
    },
  });
}

/**
 * Extension Tiptap - wiring fin autour du plugin ProseMirror ci-dessus.
 * Doit être instanciée dans le tableau passé à `useEditor` au montage
 * (jamais un singleton module partagé) - même règle StrictMode que
 * `createEditorExtensions` (cf. commentaire entity-editor.tsx).
 */
export function createLinkHighlightExtension(config: MentionHighlightConfig) {
  return Extension.create({
    name: "linkHighlight",
    addProseMirrorPlugins() {
      return [createMentionHighlightPlugin(config)];
    },
  });
}
