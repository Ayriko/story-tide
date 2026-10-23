"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createDeclaredRelationAction,
  ignoreRelationSuggestionAction,
  unignoreRelationSuggestionAction,
  type DeclaredRelationFormState,
  type RelationActionState,
} from "@/actions/declared-relations";
import type { RelationSuggestion } from "@/services/declared-relation-service";
import { Button } from "@/components/ui/button";
import { RelationTypeSelect, type RelationTypeOptions } from "./relation-type-select";

// Au-dela, la liste des suggestions est repliee (« N entrees citees sans
// relation ») pour ne pas noyer la fiche.
export const SUGGESTIONS_UNFOLDED_MAX = 5;

type Context = { worldId: string; worldSlug: string; entityId: string };

function HiddenContext({ worldId, worldSlug, entityId }: Context) {
  return (
    <>
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="entityId" value={entityId} />
    </>
  );
}

function PendingButton({
  label,
  variant,
  ariaLabel,
}: {
  label: string;
  variant: "default" | "outline";
  ariaLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending}
      aria-busy={pending}
      aria-label={ariaLabel}
      className="shrink-0"
    >
      {pending ? "..." : label}
    </Button>
  );
}

// Une suggestion = deux formulaires (ajouter avec le type choisi, ignorer),
// chacun avec son useActionState - meme patron par ligne que linked-entities.
function SuggestionRow({
  context,
  suggestion,
  options,
}: {
  context: Context;
  suggestion: RelationSuggestion;
  options: RelationTypeOptions;
}) {
  const [addState, addAction] = useActionState<DeclaredRelationFormState, FormData>(
    createDeclaredRelationAction,
    {},
  );
  const [ignoreState, ignoreAction] = useActionState<RelationActionState, FormData>(
    ignoreRelationSuggestionAction,
    {},
  );
  const selectId = `suggestion-${suggestion.id}-type`;
  const errorId = `suggestion-${suggestion.id}-error`;
  const error = addState.errors?.choice ?? addState.formError ?? ignoreState.formError;

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{suggestion.name}</span>
          <span className="text-xs text-muted-foreground">cité dans le texte</span>
        </span>
        <form action={addAction} className="ml-auto flex items-center gap-2">
          <HiddenContext {...context} />
          <input type="hidden" name="otherId" value={suggestion.id} />
          <div className="w-52">
            <RelationTypeSelect
              id={selectId}
              options={options}
              defaultValue={suggestion.preselected ?? undefined}
              ariaLabel={`Type de relation avec ${suggestion.name}`}
              invalid={addState.errors?.choice !== undefined}
              describedBy={error ? errorId : undefined}
            />
          </div>
          <PendingButton
            label="Ajouter"
            variant="default"
            ariaLabel={`Ajouter la relation avec ${suggestion.name}`}
          />
        </form>
        <form action={ignoreAction}>
          <HiddenContext {...context} />
          <input type="hidden" name="targetId" value={suggestion.id} />
          <PendingButton
            label="Ignorer"
            variant="outline"
            ariaLabel={`Ignorer la suggestion ${suggestion.name}`}
          />
        </form>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function UnignoreForm({
  context,
  target,
}: {
  context: Context;
  target: { id: string; name: string };
}) {
  const [state, formAction] = useActionState<RelationActionState, FormData>(
    unignoreRelationSuggestionAction,
    {},
  );
  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <HiddenContext {...context} />
      <input type="hidden" name="targetId" value={target.id} />
      <PendingButton
        label="Ne plus ignorer"
        variant="outline"
        ariaLabel={`Ne plus ignorer la suggestion ${target.name}`}
      />
      {state.formError ? (
        <span role="alert" className="text-xs text-destructive">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}

// Suggestions de relations (KAN-84) : entrees citees par la fiche sans
// relation declaree, type pre-selectionne selon relation-suggestions.ts. Une
// suggestion disparait des qu'une relation existe (revalidation de la page).
// Repli natif <details>/<summary> : clavier et lecteur d'ecran sans ARIA.
export function RelationSuggestions({
  worldId,
  worldSlug,
  entityId,
  suggestions,
  ignored,
  options,
}: {
  worldId: string;
  worldSlug: string;
  entityId: string;
  suggestions: RelationSuggestion[];
  ignored: { id: string; name: string }[];
  options: RelationTypeOptions;
}) {
  const context = { worldId, worldSlug, entityId };
  const list = (
    <ul className="flex flex-col gap-1.5">
      {suggestions.map((suggestion) => (
        <SuggestionRow
          key={suggestion.id}
          context={context}
          suggestion={suggestion}
          options={options}
        />
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-3">
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune entrée citée sans relation pour l&apos;instant.
        </p>
      ) : suggestions.length > SUGGESTIONS_UNFOLDED_MAX ? (
        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer text-sm text-foreground">
            {suggestions.length} entrées citées sans relation
          </summary>
          <div className="mt-2">{list}</div>
        </details>
      ) : (
        list
      )}

      {ignored.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {ignored.length === 1
              ? "1 suggestion ignorée"
              : `${ignored.length} suggestions ignorées`}
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {ignored.map((target) => (
              <li
                key={target.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5"
              >
                <span className="text-sm text-foreground">{target.name}</span>
                <UnignoreForm context={context} target={target} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
