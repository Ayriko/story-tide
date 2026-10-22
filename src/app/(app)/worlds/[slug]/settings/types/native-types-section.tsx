"use client";

import { useActionState, useOptimistic } from "react";
import { setNativeTypeHiddenAction, type WorldSettingsActionState } from "@/actions/world-settings";
import { groupedEntityTypes } from "@/lib/entity-schemas";
import { resolveEntityType, type WorldTypeCatalog } from "@/lib/entity-types";
import { cn } from "@/lib/utils";
import { EntityTypeIcon } from "../../entity-type-icon";
import { entryCountLabel } from "./entry-count";

// Curseur active = type propose (retour Aymeric : tout est active par defaut,
// on desactive ce qu'on veut masquer - plus naturel que « cocher pour cacher »).
export const COLUMN_LABEL = "Proposer le type";

// Un curseur = un <form> (KAN-81). <button type="submit" role="switch"> et
// PAS une case a cocher controlee : React 19 reinitialise le formulaire apres
// une action reussie (form.reset()), ce qui ramenait la case a son etat de
// montage (defaultChecked) alors que le serveur avait bien enregistre -
// l'interrupteur semblait ne basculer qu'au second clic (constate en
// navigateur, 2026-10-20). Un bouton n'a aucun etat DOM a reinitialiser.
// useOptimistic : bascule visible des le clic, annulee d'elle-meme si le
// serveur refuse (dernier type proposable) - son message s'affiche sous la
// ligne. Reutilise par l'onglet des types de relation (KAN-84) : seule
// l'action change.
export function NativeTypeToggle({
  worldId,
  type,
  label,
  hidden,
  action = setNativeTypeHiddenAction,
}: {
  worldId: string;
  type: string;
  label: string;
  hidden: boolean;
  action?: (
    previous: WorldSettingsActionState,
    formData: FormData,
  ) => Promise<WorldSettingsActionState>;
}) {
  const [optimisticHidden, setOptimisticHidden] = useOptimistic(hidden);
  const [state, formAction, pending] = useActionState<WorldSettingsActionState, FormData>(
    async (previous, formData) => {
      setOptimisticHidden(!hidden);
      return action(previous, formData);
    },
    {},
  );
  const errorId = `native-type-${type}-error`;

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="hidden" value={hidden ? "false" : "true"} />
      <button
        type="submit"
        role="switch"
        aria-checked={!optimisticHidden}
        // Nom complet par ligne, commencant par la legende visible de la
        // colonne (label dans le nom).
        aria-label={`${COLUMN_LABEL} ${label}`}
        aria-describedby={state.formError ? errorId : undefined}
        // aria-disabled et non disabled pendant l'envoi : un bouton desactive
        // perd le focus clavier.
        aria-disabled={pending}
        onClick={(event) => {
          if (pending) {
            event.preventDefault();
          }
        }}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          !optimisticHidden ? "border-primary bg-primary" : "border-muted-foreground bg-muted",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block size-3.5 rounded-full shadow transition-transform",
            !optimisticHidden
              ? "translate-x-[1.125rem] bg-primary-foreground"
              : "translate-x-0.5 bg-muted-foreground",
          )}
        />
      </button>
      {state.formError ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}

export function NativeTypesSection({
  worldId,
  catalog,
  usage,
}: {
  worldId: string;
  catalog: WorldTypeCatalog;
  usage: Record<string, number>;
}) {
  return (
    <section aria-labelledby="native-types-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="native-types-heading" className="font-heading text-lg font-medium text-foreground">
          Types natifs
        </h2>
        <p className="text-sm text-muted-foreground">
          Un type masqué n&apos;est plus proposé à la création ; ses entrées existantes le gardent.
        </p>
      </div>
      {groupedEntityTypes().map(({ group, types }) => (
        <div key={group} className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-4 px-4">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group}
            </h3>
            {/* Legende visible de la colonne des curseurs ; chaque curseur
                porte aussi son nom complet (aria-label). */}
            <span aria-hidden="true" className="text-xs text-muted-foreground">
              {COLUMN_LABEL}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {types.map((type) => {
              const resolved = resolveEntityType({ type, customTypeId: null }, catalog);
              return (
                <li key={type} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <EntityTypeIcon icon={resolved.icon} />
                    <span className="text-sm font-medium text-foreground">{resolved.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {entryCountLabel(usage[type] ?? 0)}
                    </span>
                  </span>
                  <NativeTypeToggle
                    worldId={worldId}
                    type={type}
                    label={resolved.label}
                    hidden={resolved.isHidden}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
