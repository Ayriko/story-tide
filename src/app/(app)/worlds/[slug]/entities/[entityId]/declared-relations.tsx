"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteDeclaredRelationAction,
  type RelationActionState,
} from "@/actions/declared-relations";
import type { DeclaredRelationView } from "@/services/declared-relation-service";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    // Bouton simple et pas AlertDialogAction (meme raison que
    // delete-entity-form.tsx) : l'echec eventuel doit pouvoir s'afficher.
    <Button type="submit" disabled={pending} aria-busy={pending} variant="destructive">
      {pending ? "Suppression..." : "Supprimer la relation"}
    </Button>
  );
}

function DeleteRelationDialog({
  worldId,
  worldSlug,
  relation,
}: {
  worldId: string;
  worldSlug: string;
  relation: DeclaredRelationView;
}) {
  const [state, formAction] = useActionState<RelationActionState, FormData>(
    deleteDeclaredRelationAction,
    {},
  );
  const description = `${relation.label} ${relation.other.name}`;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // Nom complet, commencant par le texte visible : un bouton par
          // relation, chacun distinguable au lecteur d'ecran.
          aria-label={`Supprimer la relation ${description}`}
        >
          Supprimer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la relation ?</AlertDialogTitle>
          <AlertDialogDescription>
            « {description} » disparaîtra des deux fiches. Le texte n&apos;est pas modifié.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="worldId" value={worldId} />
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="relationId" value={relation.id} />
          {state.formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.formError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <ConfirmButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Relations declarees de la fiche (KAN-84), groupees par libelle LU DEPUIS
// CETTE FICHE (« Parent de : Aldric, Mira » ; sur Aldric : « Enfant de :
// Selyne »). <dl> : le libelle est le terme, chaque entree liee une
// definition (lien de navigation + suppression).
export function DeclaredRelations({
  worldId,
  worldSlug,
  relations,
}: {
  worldId: string;
  worldSlug: string;
  relations: DeclaredRelationView[];
}) {
  if (relations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune relation déclarée pour l&apos;instant.</p>
    );
  }

  const groups = new Map<string, DeclaredRelationView[]>();
  for (const relation of relations) {
    groups.set(relation.label, [...(groups.get(relation.label) ?? []), relation]);
  }

  return (
    <dl className="flex flex-col gap-3">
      {[...groups].map(([label, members]) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </dt>
          {members.map((relation) => (
            <dd
              key={relation.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5"
            >
              <Link
                href={`/worlds/${worldSlug}/entities/${relation.other.id}`}
                className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {relation.other.name}
              </Link>
              <DeleteRelationDialog worldId={worldId} worldSlug={worldSlug} relation={relation} />
            </dd>
          ))}
        </div>
      ))}
    </dl>
  );
}
