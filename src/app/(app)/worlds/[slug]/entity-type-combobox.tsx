"use client";

import { useState, type KeyboardEvent } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { ChevronsUpDown } from "lucide-react";
import { parseTypeKey, selectableTypes } from "@/lib/entity-types";
import { Label } from "@/components/ui/label";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { useWorldTypeCatalog } from "./world-type-catalog";

// Combobox base sur le Command de shadcn/cmdk (KAN-36, solde ADR-0016) -
// remplace l'implementation interne posee par KAN-18 en attendant ce
// chantier. `shouldFilter={false}` + query/selected controles ici (au lieu du
// filtre flou integre de cmdk) : reprend exactement l'architecture et le
// filtrage substring de l'ancien composant, cmdk n'apporte que le rendu ARIA
// (combobox/listbox/option) et la navigation clavier (fleches/Entree/Home/
// End), deja audites plutot que reimplementes a la main.
//
// Panneau d'options en <div absolute> simple (PAS Popover/PopoverContent -
// deux tentatives essayees puis abandonnees, cf. historique) :
// 1) v1 (KAN-36) : le panneau vivait dans un `Card` (`overflow-hidden` dans
//    sa classe de base) - tout ce qui depassait du bord de la carte etait
//    rogne a l'affichage, ni la molette ni le clavier ne pouvaient
//    "recuperer" un contenu paint-clippe. Fixe en passant par
//    Popover/PopoverContent (Portal Radix, jamais soumis a l'overflow d'un
//    ancetre).
// 2) Ce fix a lui-meme introduit deux regressions (constatees par Aymeric) :
//    `PopoverAnchor` n'est pas exempte par Radix de sa detection "interaction
//    en dehors" (contrairement a `PopoverTrigger`) -> fermeture instantanee
//    au focus ; et une fois ouvert, le SCROLL A LA MOLETTE ne fonctionnait
//    plus du tout (seul le clavier, qui appelle scrollIntoView() en JS,
//    fonctionnait) - cause tres probable : le Popover se portage en dehors
//    du DOM du Dialog (portails Radix independants, freres sous <body>, pas
//    imbriques), et le verrou de defilement du Dialog MODAL (qui bloque le
//    scroll de tout ce qui n'est pas reconnu comme faisant partie de son
//    propre sous-arbre) bloque la molette sur ce contenu porte ailleurs -
//    un scrollIntoView() JS n'est pas un evenement wheel, il n'est jamais
//    intercepte par ce verrou, d'ou la difference exacte de symptome.
// 3) Depuis KAN-36 P2, ce composant ne vit plus JAMAIS dans un `Card` - il ne
//    vit plus que dans un `DialogContent` (creation ou reglages), qui n'a
//    PAS `overflow-hidden` dans sa classe de base (dialog.tsx) - le probleme
//    d'origine (1) ne peut donc plus se produire. Retour a un simple
//    <div absolute> (comme avant KAN-36), sans aucun Portal ni mecanisme de
//    Radix a neutraliser - plus simple, et les deux classes de bug
//    disparaissent par construction plutot que d'etre contournees.
//
// Icone : CommandInput de shadcn (command.tsx) embarque en dur une loupe
// (InputGroupAddon + SearchIcon) - adaptee a une vraie recherche (sidebar),
// pas a ce selecteur de TYPE. Utilise ici le primitif brut Command.Input du
// paquet cmdk (celui que CommandInput enveloppe de toute facon) avec une
// icone chevron (plus juste pour un combobox/select), meme mecanique cmdk.
//
// L'accessible name du champ (role="combobox") vient du `label` interne de
// cmdk (associe via un <label> invisible que cmdk genere lui-meme, id auto) -
// pas de <Label htmlFor> possible ici (cmdk regenere son propre id sur
// l'input, ecrasant tout id fourni). Le <Label> shadcn ci-dessous reste donc
// purement visuel (pas de htmlFor), coherent avec les autres champs du
// formulaire, sans dupliquer le nom accessible.
//
// Champ de FORMULAIRE (pas une popup d'editeur) : des <input type="hidden">
// portent la vraie valeur soumise - `name` (cle native ou sentinelle
// "custom") et "customTypeId" (vide pour un natif, KAN-81) - lues depuis le
// FormData par le <form action> existant (useActionState).
//
// Types proposes (KAN-81) : ceux du monde (catalogue en contexte) -
// personnalises dans leur groupe avec une marque discrete « perso », natifs
// masques absents, sauf `keepTypeKey` (type courant de l'entree modifiee).
// Valeurs manipulees ici = cles resolues (native ou `custom:<id>`).
export function EntityTypeCombobox({
  id,
  name,
  label,
  defaultValue,
  keepTypeKey,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  keepTypeKey?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const groups = selectableTypes(useWorldTypeCatalog(), keepTypeKey);
  const labelOf = (key: string) =>
    groups.flatMap(({ types }) => types).find((type) => type.key === key)?.label ?? "";
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState(labelOf(defaultValue));
  const [open, setOpen] = useState(false);

  // useActionState re-rend le MEME composant (pas de remontage) apres un
  // echec de soumission avec des valeurs reaffichees differentes - re-sync
  // pendant le rendu plutot que dans un effet (meme patron que
  // mention-list.tsx pour "reinitialiser un state quand une prop change").
  const [previousDefaultValue, setPreviousDefaultValue] = useState(defaultValue);
  if (defaultValue !== previousDefaultValue) {
    setPreviousDefaultValue(defaultValue);
    setSelected(defaultValue);
    setQuery(labelOf(defaultValue));
  }

  // Tant que l'utilisateur n'a rien tape de different du libelle deja
  // selectionne (ouverture au focus/clic, navigation clavier immediate), la
  // liste complete reste visible - le filtrage ne s'active qu'une fois le
  // texte affiche divergent de la selection courante.
  const needle = query === labelOf(selected) ? "" : query.trim().toLowerCase();
  const filteredGroups = groups
    .map(({ group, types }) => ({
      group,
      types: types.filter((type) => type.label.toLowerCase().includes(needle)),
    }))
    .filter(({ types }) => types.length > 0);
  const hasOptions = filteredGroups.length > 0;
  const submitted = parseTypeKey(selected);

  function commit(key: string) {
    setSelected(key);
    setQuery(labelOf(key));
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div id={id} className="relative flex flex-col gap-1.5">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={submitted?.type ?? ""} />
      <input type="hidden" name="customTypeId" value={submitted?.customTypeId ?? ""} />
      <Command shouldFilter={false} label={label} className="overflow-visible bg-transparent p-0">
        <InputGroup>
          <CommandPrimitive.Input
            value={query}
            onValueChange={(value: string) => {
              setQuery(value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // Le texte tape peut ne correspondre a aucun type (recherche en
              // cours abandonnee) - revenir au libelle du dernier type valide
              // selectionne, jamais a une valeur flottante invalide.
              setQuery(labelOf(selected));
              setOpen(false);
            }}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            className="flex-1 rounded-none border-0 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          <InputGroupAddon align="inline-end">
            <ChevronsUpDown aria-hidden="true" className="size-4 opacity-50" />
          </InputGroupAddon>
        </InputGroup>
        {open ? (
          <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            <CommandList label={label} className="max-h-72">
              {!hasOptions ? (
                <p className="px-3 py-1.5 text-sm text-muted-foreground">Aucun type trouvé.</p>
              ) : (
                filteredGroups.map(({ group, types }) => (
                  <CommandGroup key={group} heading={group}>
                    {types.map((type) => (
                      <CommandItem
                        key={type.key}
                        value={type.key}
                        onMouseDown={(event) => {
                          // preventDefault : evite que le blur du champ texte
                          // ne ferme la liste avant que le clic ne s'applique.
                          event.preventDefault();
                        }}
                        onSelect={() => commit(type.key)}
                        // Nom accessible explicite (KAN-81) : la marque visuelle
                        // « perso » est masquee aux lecteurs d'ecran, remplacee
                        // par une mention complete.
                        aria-label={type.isCustom ? `${type.label} (type personnalisé)` : undefined}
                      >
                        {type.label}
                        {type.isCustom ? (
                          <span
                            aria-hidden="true"
                            className="ml-auto text-xs text-muted-foreground"
                          >
                            perso
                          </span>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              )}
            </CommandList>
          </div>
        ) : null}
      </Command>
    </div>
  );
}
