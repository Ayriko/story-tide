"use client";

import { useState, type KeyboardEvent } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { ChevronsUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";

export type TargetEntityOption = { id: string; name: string; typeLabel: string };

// Nombre maximal d'options rendues : la liste filtre au fil de la frappe, un
// monde de plusieurs centaines d'entrees ne rend jamais tout d'un coup.
const MAX_OPTIONS = 50;

// Choix de l'entree cible d'une relation (KAN-84), sur l'architecture
// d'EntityTypeCombobox (ADR-0016, voir ses commentaires pour le panneau en
// <div absolute> et le nom accessible porte par cmdk) : query/selection
// controlees ici, cmdk n'apporte que le rendu ARIA et la navigation clavier.
// Les entrees arrivent deja chargees par la page (type deja resolu, sans la
// fiche courante) - filtrage cote client, aucun appel reseau a la frappe.
// La valeur soumise est l'id, dans un <input type="hidden" name={name}>.
export function EntityTargetCombobox({
  id,
  name,
  label,
  entities,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  label: string;
  entities: TargetEntityOption[];
  invalid?: boolean;
  describedBy?: string;
}) {
  const [selected, setSelected] = useState<TargetEntityOption | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const needle = query === (selected?.name ?? "") ? "" : query.trim().toLocaleLowerCase("fr");
  const matches = entities
    .filter((entity) => entity.name.toLocaleLowerCase("fr").includes(needle))
    .slice(0, MAX_OPTIONS);

  function commit(entity: TargetEntityOption) {
    setSelected(entity);
    setQuery(entity.name);
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
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <Command shouldFilter={false} label={label} className="overflow-visible bg-transparent p-0">
        <InputGroup>
          <CommandPrimitive.Input
            value={query}
            placeholder="Rechercher une entrée…"
            onValueChange={(value: string) => {
              setQuery(value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // Texte abandonne sans selection : retour au nom de l'entree
              // choisie (ou vide), jamais une valeur flottante.
              setQuery(selected?.name ?? "");
              setOpen(false);
            }}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            className="flex-1 rounded-none border-0 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
          <InputGroupAddon align="inline-end">
            <ChevronsUpDown aria-hidden="true" className="size-4 opacity-50" />
          </InputGroupAddon>
        </InputGroup>
        {open ? (
          <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            <CommandList label={label} className="max-h-72">
              {matches.length === 0 ? (
                <p className="px-3 py-1.5 text-sm text-muted-foreground">Aucune entrée trouvée.</p>
              ) : (
                matches.map((entity) => (
                  <CommandItem
                    key={entity.id}
                    value={entity.id}
                    onMouseDown={(event) => {
                      // Evite que le blur du champ ne ferme la liste avant le clic.
                      event.preventDefault();
                    }}
                    onSelect={() => commit(entity)}
                  >
                    <span className="truncate">{entity.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {entity.typeLabel}
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandList>
          </div>
        ) : null}
      </Command>
    </div>
  );
}
