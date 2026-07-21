"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { unignoreLinkAction, type LinkIgnoreFormState } from "@/actions/link-ignore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { IgnoredTarget } from "@/services/relation-service";

const initialState: LinkIgnoreFormState = {};

function UnignoreButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      className="shrink-0"
    >
      {pending ? "..." : "Ne plus ignorer"}
    </Button>
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
        <span role="alert" className="text-xs text-destructive">
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
    return <p className="text-sm text-muted-foreground">Aucun lien ignoré pour l&apos;instant.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {targets.map((target) => (
        <li key={target.id}>
          <Card className="flex-row items-center justify-between px-3 py-2">
            <span className="text-sm font-medium text-foreground">{target.name}</span>
            <UnignoreLinkForm
              worldId={worldId}
              worldSlug={worldSlug}
              entityId={entityId}
              targetId={target.id}
            />
          </Card>
        </li>
      ))}
    </ul>
  );
}
