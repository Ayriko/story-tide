import type { RelationTypeOption } from "@/lib/relation-types";
import { SELECT_CLASS } from "../../settings/types/custom-type-form";

export type RelationTypeOptions = {
  symmetric: RelationTypeOption[];
  directed: RelationTypeOption[];
};

function OptionList({ options }: { options: RelationTypeOption[] }) {
  return options.map((option) => (
    <option key={option.value} value={option.value}>
      {option.isCustom ? `${option.label} (perso)` : option.label}
    </option>
  ));
}

// Select NATIF du type de relation (KAN-84) : deux groupes, « Symetriques »
// et « Dirigees » ; un type dirige y figure deux fois (son libelle et son
// inverse) pour choisir le sens depuis la fiche courante. Non controle
// (defaultValue) : reinitialise par React 19 apres un ajout reussi, c'est
// l'effet voulu. Partage par « Ajouter une relation » et les suggestions.
export function RelationTypeSelect({
  id,
  options,
  defaultValue,
  invalid,
  describedBy,
  ariaLabel,
}: {
  id: string;
  options: RelationTypeOptions;
  defaultValue?: string;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      id={id}
      name="choice"
      defaultValue={defaultValue ?? ""}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      className={SELECT_CLASS}
    >
      <option value="">Choisir un type…</option>
      {options.symmetric.length > 0 ? (
        <optgroup label="Symétriques">
          <OptionList options={options.symmetric} />
        </optgroup>
      ) : null}
      {options.directed.length > 0 ? (
        <optgroup label="Dirigées">
          <OptionList options={options.directed} />
        </optgroup>
      ) : null}
    </select>
  );
}
