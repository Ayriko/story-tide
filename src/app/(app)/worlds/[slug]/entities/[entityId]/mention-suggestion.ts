"use client";

import { ReactRenderer } from "@tiptap/react";
import {
  filterMentionSuggestions,
  type MentionSuggestionConfig,
  type MentionSuggestionItem,
} from "@/lib/tiptap-extensions";
import { MentionList, type MentionListHandle } from "./mention-list";

// Popup @ (KAN-22) : positionnement gere par @tiptap/suggestion (Floating UI
// integre via props.mount) - jamais de tippy.js. items() filtre en memoire la
// liste d'entites du monde deja chargee avec la page (filterMentionSuggestions,
// pur/teste isolement) - meme convention que `dictionary` pour le surlignage
// live, aucun appel reseau a la frappe.
export function createMentionSuggestion(
  entities: MentionSuggestionItem[],
): MentionSuggestionConfig {
  return {
    items: ({ query }) => filterMentionSuggestions(entities, query),
    render: () => {
      let component: ReactRenderer<MentionListHandle> | null = null;
      let unmount: (() => void) | null = null;

      return {
        onStart: (props) => {
          // className: "z-50" (KAN-19, bug flou/illisible - 2e tentative) :
          // ReactRenderer cree SON PROPRE wrapper <div class="react-renderer">
          // (component.element) et y monte MentionList via un portail React -
          // c'est CE wrapper que props.mount() positionne (absolute) et
          // ajoute a document.body, jamais l'element rendu par MentionList
          // lui-meme. Un z-* pose sur la racine JSX de MentionList (1re
          // tentative, retiree de mention-list.tsx) etait donc a la fois sur
          // le mauvais element ET sans effet (position: static, z-index
          // ignore). Meme convention que les autres overlays portales
          // (Dialog/AlertDialog/DropdownMenu/Popover, tous z-50).
          component = new ReactRenderer(MentionList, {
            editor: props.editor,
            props,
            className: "z-50",
          });
          if (!props.clientRect) {
            return;
          }
          unmount = props.mount(component.element);
        },
        onUpdate(props) {
          component?.updateProps(props);
        },
        onKeyDown(props) {
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          unmount?.();
          component?.destroy();
          component = null;
          unmount = null;
        },
      };
    },
  };
}
