"use client";

import { setNativeRelationTypeHiddenAction } from "@/actions/world-settings";
import { allRelationTypes, type WorldRelationTypeCatalog } from "@/lib/relation-types";
import { COLUMN_LABEL, NativeTypeToggle } from "../types/native-types-section";
import { relationCountLabel } from "./relation-count";

// Types de relation natifs (KAN-84) : libelle (et inverse pour un dirige),
// nombre de relations, curseur « Proposer le type » - meme bouton +
// useOptimistic que les types d'entrees (KAN-81). Le serveur garde au moins
// un type proposable.
export function NativeRelationTypesSection({
  worldId,
  catalog,
  usage,
}: {
  worldId: string;
  catalog: WorldRelationTypeCatalog;
  usage: Record<string, number>;
}) {
  const natives = allRelationTypes(catalog).filter((type) => !type.isCustom);
  const groups = [
    { title: "Symétriques", types: natives.filter((type) => type.symmetric) },
    { title: "Dirigées", types: natives.filter((type) => !type.symmetric) },
  ];

  return (
    <section aria-labelledby="native-relation-types-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2
          id="native-relation-types-heading"
          className="font-heading text-lg font-medium text-foreground"
        >
          Types natifs
        </h2>
        <p className="text-sm text-muted-foreground">
          Un type masqué n&apos;est plus proposé sur les fiches ; ses relations existantes le
          gardent.
        </p>
      </div>
      {groups.map(({ title, types }) => (
        <div key={title} className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-4 px-4">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {title}
            </h3>
            <span aria-hidden="true" className="text-xs text-muted-foreground">
              {COLUMN_LABEL}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {types.map((type) => (
              <li key={type.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-foreground">{type.label}</span>
                  {type.inverseLabel ? (
                    <span className="text-sm text-muted-foreground">/ {type.inverseLabel}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {relationCountLabel(usage[type.key] ?? 0)}
                  </span>
                </span>
                <NativeTypeToggle
                  worldId={worldId}
                  type={type.key}
                  label={type.label}
                  hidden={type.isHidden}
                  action={setNativeRelationTypeHiddenAction}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
