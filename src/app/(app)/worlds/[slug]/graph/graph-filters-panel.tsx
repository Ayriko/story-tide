"use client";

import { Check } from "lucide-react";
import {
  FOCUS_DEPTHS,
  depthLabel,
  type EntryTypeFilterGroup,
  type FocusDepth,
  type GraphFilters,
  type RelationFilterOption,
} from "@/lib/graph-filters";
import { cn } from "@/lib/utils";
import { SELECT_CLASS } from "../settings/types/custom-type-form";

const SECTION_BUTTON_CLASS =
  "text-(--glass-text-muted) hover:text-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function toggled(list: readonly string[], key: string): string[] {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
}

// Chip a etat (chip pressee = visible) : vrai <button aria-pressed>. L'etat
// se lit sans la couleur (retour de recette) : pressee = pastille PLEINE avec
// une coche, non pressee = simple contour sans coche. Couples de couleurs
// deja valides ailleurs (bouton par defaut : bg-primary /
// text-primary-foreground ; contour : --glass-text-muted, gris AA sur le
// verre au-dessus du ciel, KAN-85).
function FilterChip({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-(--glass-text-muted) hover:bg-accent",
      )}
    >
      {pressed ? <Check aria-hidden="true" className="size-2.5 shrink-0" /> : null}
      {label}
    </button>
  );
}

// Contenu du panneau « Filtres » (KAN-36 P5b, KAN-87), ouvert depuis la
// rangee d'outils de la Constellation : types d'entree (par groupe), types
// de relation, focus (isoler / masquer + profondeur). Filtrage du canvas ET
// de la liste accessible (memes filtres).
export function GraphFiltersPanel({
  filterGroups,
  relationOptions,
  isolatedCount,
  filters,
  focusEntityName,
  onChange,
}: {
  filterGroups: EntryTypeFilterGroup[];
  relationOptions: RelationFilterOption[];
  // Entrees sans aucun lien dans le monde (KAN-85) : 0 = section masquee.
  isolatedCount: number;
  filters: GraphFilters;
  focusEntityName: string | null;
  onChange: (next: GraphFilters) => void;
}) {
  const focus = filters.focus;

  function setGroupHidden(types: readonly string[], hidden: boolean) {
    const next = new Set(filters.hiddenTypeKeys);
    for (const type of types) {
      if (hidden) {
        next.add(type);
      } else {
        next.delete(type);
      }
    }
    onChange({ ...filters, hiddenTypeKeys: [...next] });
  }

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="graph-filters-entry-types" className="flex flex-col gap-2">
        <h3
          id="graph-filters-entry-types"
          className="text-[11px] font-semibold uppercase text-(--glass-text-muted)"
        >
          Types d&apos;entrée
        </h3>
        {filterGroups.map(({ group, types }) => (
          <fieldset key={group} className="flex flex-col gap-1">
            <legend className="flex w-full items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-(--glass-text-muted)">{group}</span>
              <span className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() =>
                    setGroupHidden(
                      types.map(({ key }) => key),
                      false,
                    )
                  }
                  className={SECTION_BUTTON_CLASS}
                >
                  Tout
                </button>
                <span aria-hidden="true" className="text-(--glass-text-muted)">
                  /
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setGroupHidden(
                      types.map(({ key }) => key),
                      true,
                    )
                  }
                  className={SECTION_BUTTON_CLASS}
                >
                  Rien
                </button>
              </span>
            </legend>
            <div className="flex flex-wrap gap-1">
              {types.map((type) => (
                <FilterChip
                  key={type.key}
                  label={`${type.label} · ${type.count}`}
                  pressed={!filters.hiddenTypeKeys.includes(type.key)}
                  onClick={() =>
                    onChange({
                      ...filters,
                      hiddenTypeKeys: toggled(filters.hiddenTypeKeys, type.key),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
        ))}
      </section>

      {relationOptions.length > 0 ? (
        <section aria-labelledby="graph-filters-relation-types" className="flex flex-col gap-1">
          <h3
            id="graph-filters-relation-types"
            className="text-[11px] font-semibold uppercase text-(--glass-text-muted)"
          >
            Types de relation
          </h3>
          <div className="flex flex-wrap gap-1">
            {relationOptions.map((option) => (
              <FilterChip
                key={option.key}
                label={option.label}
                pressed={!filters.hiddenRelationKeys.includes(option.key)}
                onClick={() =>
                  onChange({
                    ...filters,
                    hiddenRelationKeys: toggled(filters.hiddenRelationKeys, option.key),
                  })
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {isolatedCount > 0 ? (
        <section aria-labelledby="graph-filters-stars" className="flex flex-col gap-1">
          <h3
            id="graph-filters-stars"
            className="text-[11px] font-semibold uppercase text-(--glass-text-muted)"
          >
            Étoiles
          </h3>
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label={`Étoiles sans lien · ${isolatedCount}`}
              pressed={!filters.hideIsolated}
              onClick={() => onChange({ ...filters, hideIsolated: !filters.hideIsolated })}
            />
          </div>
        </section>
      ) : null}

      {focus ? (
        <section aria-labelledby="graph-filters-focus" className="flex flex-col gap-1.5">
          <h3
            id="graph-filters-focus"
            className="text-[11px] font-semibold uppercase text-(--glass-text-muted)"
          >
            {focus.mode === "isolate" ? "Isolement" : "Masquage"}
            {focusEntityName ? ` : ${focusEntityName}` : ""}
          </h3>
          <label className="flex flex-col gap-1 text-[11px] text-(--glass-text-muted)">
            Mode
            <select
              value={focus.mode}
              onChange={(event) =>
                onChange({
                  ...filters,
                  focus: {
                    ...focus,
                    mode: event.target.value === "hide" ? "hide" : "isolate",
                  },
                })
              }
              className={SELECT_CLASS}
            >
              <option value="isolate">Isoler</option>
              <option value="hide">Masquer</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-(--glass-text-muted)">
            Profondeur
            <select
              value={String(focus.depth)}
              onChange={(event) => {
                const depth = FOCUS_DEPTHS.find((value) => String(value) === event.target.value);
                if (depth !== undefined) {
                  onChange({ ...filters, focus: { ...focus, depth } });
                }
              }}
              className={SELECT_CLASS}
            >
              {FOCUS_DEPTHS.map((depth: FocusDepth) => (
                <option key={String(depth)} value={String(depth)}>
                  {depthLabel(depth)}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}
    </div>
  );
}
