"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { unignoreLinkAction, type LinkIgnoreFormState } from "@/actions/link-ignore";
import type { IgnoredTarget } from "@/services/relation-service";

const initialState: LinkIgnoreFormState = {};

function UnignoreButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-50"
    >
      {pending ? "..." : "Ne plus ignorer"}
    </button>
  );
}

function UnignoreLinkForm({
  worldId,
  worldSlug,
  entityId,
  targetId,
}: {
  worldId: string;
  worldSlug: string;
  entityId: string;
  targetId: string;
}) {
  const [state, formAction] = useActionState(unignoreLinkAction, initialState);
  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="targetId" value={targetId} />
      <UnignoreButton />
      {state.formError ? (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}

// Cibles actuellement ignorees pour cette fiche (KAN-23, garde-fou
// anti-faux-positifs) - symetrique de LinkedEntities mais jamais un Link de
// navigation : une cible ignoree n'est pas une relation active, seulement une
// exclusion reversible via "Ne plus ignorer" (elle redevient detectable au
// prochain scan AUTO).
export function IgnoredLinks({
  worldId,
  worldSlug,
  entityId,
  targets,
}: {
  worldId: string;
  worldSlug: string;
  entityId: string;
  targets: IgnoredTarget[];
}) {
  if (targets.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Aucun lien ignoré pour l&apos;instant.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {targets.map((target) => (
        <li
          key={target.id}
          className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-950 dark:border-zinc-800 dark:text-zinc-50"
        >
          <span>{target.name}</span>
          <UnignoreLinkForm
            worldId={worldId}
            worldSlug={worldSlug}
            entityId={entityId}
            targetId={target.id}
          />
        </li>
      ))}
    </ul>
  );
}
