"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  ENTITY_TYPE_REFERENCE,
  entityTypeLabel,
  groupedEntityTypes,
  type EntityType,
} from "@/lib/entity-schemas";
import { inputClassName, labelClassName } from "@/app/(app)/form-styles";

// Combobox interne (KAN-18, cadrage 19/07) : shadcn/cmdk absent du stack
// aujourd'hui et KAN-36 (passe visuelle shadcn) arrive juste apres ce sprint
// - decision actee de reprendre le patron deja etabli par mention-list.tsx
// (role="listbox"/"option", nav clavier fleches+Entree+Echap, aria-activedescendant
// sur l'ancre plutot que deplacer le focus) plutot que d'introduire une
// dependance qui serait remplacee des KAN-36 (voir ADR-0016).
//
// Champ de FORMULAIRE (pas une popup d'editeur) : un <input type="hidden">
// porte la vraie valeur soumise (name), le champ texte visible ne sert qu'a
// filtrer/afficher le libelle - le <form action> existant (useActionState)
// n'a besoin d'aucun changement pour lire "type" depuis le FormData.
export function EntityTypeCombobox({
  id,
  name,
  label,
  defaultValue,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState(entityTypeLabel(defaultValue));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // useActionState re-rend le MEME composant (pas de remontage) apres un
  // echec de soumission avec des valeurs reaffichees differentes - re-sync
  // pendant le rendu plutot que dans un effet (meme patron que
  // mention-list.tsx pour "reinitialiser un state quand une prop change").
  const [previousDefaultValue, setPreviousDefaultValue] = useState(defaultValue);
  if (defaultValue !== previousDefaultValue) {
    setPreviousDefaultValue(defaultValue);
    setSelected(defaultValue);
    setQuery(entityTypeLabel(defaultValue));
  }

  const listboxId = `${id}-listbox`;
  // Tant que l'utilisateur n'a rien tape de different du libelle deja
  // selectionne (ouverture au focus/clic, navigation clavier immediate), la
  // liste complete reste visible - le filtrage ne s'active qu'une fois le
  // texte affiche divergent de la selection courante.
  const needle = query === entityTypeLabel(selected) ? "" : query.trim().toLowerCase();
  const filteredGroups = groupedEntityTypes()
    .map(({ group, types }) => ({
      group,
      types: types.filter((type) =>
        ENTITY_TYPE_REFERENCE[type].label.toLowerCase().includes(needle),
      ),
    }))
    .filter(({ types }) => types.length > 0);
  const flatOptions: EntityType[] = filteredGroups.flatMap(({ types }) => types);

  function optionId(type: string): string {
    return `${id}-option-${type}`;
  }

  function commit(type: EntityType) {
    setSelected(type);
    setQuery(entityTypeLabel(type));
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, flatOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const type = flatOptions[activeIndex];
      if (open && type) {
        event.preventDefault();
        commit(type);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const activeType = flatOptions[activeIndex];

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <input type="hidden" name={name} value={selected} />
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeType ? optionId(activeType) : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        className={inputClassName}
        value={query}
        onFocus={() => {
          setOpen(true);
          // Met en surbrillance le type deja selectionne (pas toujours le
          // premier de la liste) quand la liste complete s'ouvre au focus.
          const currentIndex = flatOptions.indexOf(selected as EntityType);
          setActiveIndex(currentIndex === -1 ? 0 : currentIndex);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Le texte tape peut ne correspondre a aucun type (recherche en
          // cours abandonnee) - revenir au libelle du dernier type valide
          // selectionne, jamais a une valeur flottante invalide.
          setQuery(entityTypeLabel(selected));
          setOpen(false);
        }}
      />
      {open ? (
        <div
          role="listbox"
          id={listboxId}
          aria-label={label}
          className="absolute top-full z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-800 dark:bg-zinc-900"
        >
          {flatOptions.length === 0 ? (
            <p className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              Aucun type trouvé.
            </p>
          ) : (
            filteredGroups.map(({ group, types }) => (
              <div key={group} role="group" aria-labelledby={`${id}-group-${group}`}>
                <p
                  id={`${id}-group-${group}`}
                  role="presentation"
                  className="px-3 pt-1.5 pb-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                >
                  {group}
                </p>
                {types.map((type) => {
                  const index = flatOptions.indexOf(type);
                  return (
                    <div
                      key={type}
                      id={optionId(type)}
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseDown={(event) => {
                        // preventDefault : evite que le blur du champ texte
                        // ne ferme la liste avant que le clic ne s'applique.
                        event.preventDefault();
                        commit(type);
                      }}
                      className={`cursor-pointer px-3 py-1.5 text-sm ${
                        index === activeIndex
                          ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
                          : "text-zinc-900 dark:text-zinc-100"
                      }`}
                    >
                      {ENTITY_TYPE_REFERENCE[type].label}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
