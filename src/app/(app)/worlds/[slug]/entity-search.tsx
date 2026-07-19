"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { searchEntitiesAction } from "@/actions/entity";
import { entityTypeLabel } from "@/lib/entity-schemas";
import { inputClassName, labelClassName } from "@/app/(app)/form-styles";
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
        <label htmlFor="entity-search" className={labelClassName}>
          Rechercher une fiche
        </label>
        <input
          type="search"
          id="entity-search"
          name="entity-search"
          className={inputClassName}
          placeholder="Nom ou alias…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            scheduleSearch(event.target.value);
          }}
        />
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {query.trim().length === 0
          ? null
          : `${results.length} résultat${results.length > 1 ? "s" : ""}`}
      </p>

      {results.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {query.trim().length === 0 ? "Aucune fiche pour le moment." : "Aucune entité trouvée."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((entity) => (
            <li key={entity.id}>
              <Link
                href={`/worlds/${worldSlug}/entities/${entity.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-50"
              >
                <span>{entity.name}</span>
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {entityTypeLabel(entity.type)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
