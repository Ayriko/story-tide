"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ignoreLinkAction, type LinkIgnoreFormState } from "@/actions/link-ignore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { LinkedEntity } from "@/services/relation-service";

const initialIgnoreState: LinkIgnoreFormState = {};

function IgnoreButton() {
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
      {pending ? "..." : "Ignorer ce lien"}
    </Button>
  );
}

// Un formulaire par entree (pas un seul formulaire pour toute la liste) : usage
// d'un hook (useActionState) par ligne, chacune revalidant/agissant sur SA
// propre paire source->cible independamment des autres.
function IgnoreLinkForm({
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
  const [state, formAction] = useActionState(ignoreLinkAction, initialIgnoreState);
  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="targetId" value={targetId} />
      <IgnoreButton />
      {state.formError ? (
        <span role="alert" className="text-xs text-destructive">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}

// Chemin de navigation ACCESSIBLE (clavier/lecteur d'ecran) vers les fiches
// liees - le surlignage live dans l'editeur (tiptap-link-highlight.ts,
// Ctrl/Cmd+clic) n'est atteignable qu'a la souris, cf. RGAA. HTML semantique
// (nav + ul + vrais <Link>) : aucun ARIA necessaire au-dela de aria-labelledby
// pour associer la liste a son titre de section. Reutilise pour les deux sens
// (liens sortants et backlinks entrants, KAN-24) via `label`/`emptyLabel` -
// chaque <nav> garde un nom accessible distinct.
//
// `ignoreContext` (KAN-23, garde-fou anti-faux-positifs) : fourni uniquement
// par la section "Entites liees" (sortant, source = fiche courante), jamais
// par "Mentionne par" (entrant) - l'action ignore/delie est scopee a la fiche
// SOURCE, un backlink n'a pas de sens a "ignorer depuis la cible". Le bouton
// n'apparait que pour les entrees origin=AUTO (le ticket cible explicitement
// l'anti-faux-positif automatique, jamais une mention MANUAL).
export function LinkedEntities({
  worldSlug,
  links,
  label,
  emptyLabel,
  ignoreContext,
}: {
  worldSlug: string;
  links: LinkedEntity[];
  label: string;
  emptyLabel: string;
  ignoreContext?: { worldId: string; worldSlug: string; entityId: string };
}) {
  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-1.5">
        {links.map((link) => (
          <li key={link.id} className="flex items-center gap-2">
            <Link
              href={`/worlds/${worldSlug}/entities/${link.id}`}
              className="block flex-1 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Card className="flex-row items-center gap-2 px-3 py-2 transition-colors hover:bg-accent">
                <span className="text-sm font-medium text-foreground">{link.name}</span>
                {link.origin === "MANUAL" ? (
                  <span className="text-xs text-muted-foreground">Liaison manuel</span>
                ) : null}
              </Card>
            </Link>
            {ignoreContext && link.origin === "AUTO" ? (
              <IgnoreLinkForm
                worldId={ignoreContext.worldId}
                worldSlug={ignoreContext.worldSlug}
                entityId={ignoreContext.entityId}
                targetId={link.id}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
