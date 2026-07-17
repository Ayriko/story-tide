"use client";

import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import type { MentionSuggestionItem } from "@/lib/tiptap-extensions";

export interface MentionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export function mentionOptionId(id: string): string {
  return `mention-suggestion-option-${id}`;
}

// Popup de suggestion @ (KAN-22), montee par ReactRenderer + props.mount()
// (entity-editor.tsx) - jamais de tippy.js, positionnement gere par
// @tiptap/suggestion (Floating UI integre). Le focus reste dans l'editeur
// pendant la frappe ("@requete") : la navigation clavier (Fleches/Entree)
// passe par le handle imperatif expose ci-dessous, pas par le focus DOM
// natif de cette liste - Echap est deja gere nativement par le plugin
// Suggestion (dismiss systematique), rien a faire ici pour cette touche.
export function MentionList({
  items,
  command,
  editor,
  ref,
}: SuggestionProps<MentionSuggestionItem> & { ref: Ref<MentionListHandle> }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Reajuste pendant le rendu plutot que dans un effet (evite le rendu en
  // cascade qu'un setState synchrone dans useEffect declencherait) - pattern
  // documente pour "reinitialiser un state quand une prop change".
  const [previousItems, setPreviousItems] = useState(items);
  if (items !== previousItems) {
    setPreviousItems(items);
    setSelectedIndex(0);
  }

  function selectItem(index: number) {
    const item = items[index];
    if (item) {
      command(item);
    }
  }

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (items.length === 0) {
        return false;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelectedIndex((index) => (index + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  // aria-activedescendant pose sur le contentEditable (jamais sur la popup :
  // le focus reel n'y va jamais) - convention standard d'un widget combobox/
  // listbox ancre sur un champ de texte, pour qu'un lecteur d'ecran annonce
  // l'option courante suivie au clavier sans deplacer le focus.
  useEffect(() => {
    const dom = editor.view.dom;
    const activeItem = items[selectedIndex];
    if (!activeItem) {
      dom.removeAttribute("aria-activedescendant");
      return;
    }
    dom.setAttribute("aria-activedescendant", mentionOptionId(activeItem.id));
    return () => {
      dom.removeAttribute("aria-activedescendant");
    };
  }, [editor, items, selectedIndex]);

  if (items.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="Entités correspondantes"
        className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
      >
        Aucune entité trouvée.
      </div>
    );
  }

  return (
    <ul
      role="listbox"
      aria-label="Entités correspondantes"
      className="flex max-h-56 flex-col overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          id={mentionOptionId(item.id)}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => selectItem(index)}
          className={`cursor-pointer px-3 py-1.5 text-sm ${
            index === selectedIndex
              ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}
