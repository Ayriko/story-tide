"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { searchEntitiesAction } from "@/actions/entity";
import { entityTypeLabel } from "@/lib/entity-schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { EntitySearchResult } from "@/services/entity-service";

const SEARCH_DEBOUNCE_MS = 300;

// Meme patron de debounce que l'auto-save de l'editeur (entity-editor.tsx,
// scheduleSave) : useRef+setTimeout, pas de dependance externe. Requete vide
// (apres trim) -> reaffiche la liste initiale (SSR) sans appeler le serveur,
// aucun flash au chargement de la page.
export function EntitySearch({
  worldId,
  worldSlug,
  initialEntities,
}: {
  worldId: string;
  worldSlug: string;
  initialEntities: EntitySearchResult[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntitySearchResult[]>(initialEntities);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSearch = useCallback(
    (rawQuery: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const trimmed = rawQuery.trim();
      if (trimmed.length === 0) {
        setErrorMessage(null);
        setResults(initialEntities);
        return;
      }
      timeoutRef.current = setTimeout(() => {
        void searchEntitiesAction(worldId, trimmed).then((result) => {
          if (result.ok) {
            setErrorMessage(null);
            setResults(result.entities);
          } else {
            setErrorMessage(result.error);
          }
        });
      }, SEARCH_DEBOUNCE_MS);
    },
    [worldId, initialEntities],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="entity-search">Rechercher une fiche</Label>
        <Input
          type="search"
          id="entity-search"
          name="entity-search"
          placeholder="Nom ou alias…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            scheduleSearch(event.target.value);
          }}
        />
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {query.trim().length === 0
          ? null
          : `${results.length} résultat${results.length > 1 ? "s" : ""}`}
      </p>

      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query.trim().length === 0 ? "Aucune fiche pour le moment." : "Aucune entité trouvée."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((entity) => (
            <li key={entity.id}>
              <Link
                href={`/worlds/${worldSlug}/entities/${entity.id}`}
                className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Card className="flex-row items-center justify-between px-4 py-3 transition-colors hover:bg-accent">
                  <span className="text-sm font-medium text-foreground">{entity.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {entityTypeLabel(entity.type)}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
