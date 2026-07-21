"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { searchEntitiesAction } from "@/actions/entity";
import { entityTypeGroup, entityTypeLabel, groupedEntityTypes } from "@/lib/entity-schemas";
import type { EntityTypeGroup } from "@/lib/entity-schemas";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import type { EntitySearchResult } from "@/services/entity-service";
import { EntityTypeIcon } from "./entity-type-icon";

const SEARCH_DEBOUNCE_MS = 300;
// Evenement DOM prive (KAN-36 P3) : le dashboard (chip "Rechercher") demande
// le focus sur ce champ sans le tenir directement (compose depuis un autre
// composant, meme patron que COLLAPSE_EVENT dans world-shell.tsx).
export const FOCUS_SEARCH_EVENT = "story-tide:focus-search";

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
  const inputRef = useRef<HTMLInputElement>(null);
  // Etat de repli par groupe (KAN-36 P3 point 5) : simple useState, pas de
  // localStorage/evenement DOM comme le repli de la sidebar entiere
  // (world-shell.tsx) - ce composant vit dans le layout du monde, qui
  // persiste tel quel a travers toutes les navigations internes (App
  // Router, segment partage) : l'etat "survit" deja a la navigation sans
  // plomberie supplementaire. Aucune persistance inter-rechargement, non
  // demandee.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<EntityTypeGroup>>(new Set());

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

  // Chip "Rechercher" du dashboard (KAN-36 P3) : deplie la sidebar (ecoute
  // dans world-shell.tsx) puis emet cet evenement pour deporter le focus ici,
  // sans qu'aucun composant ne tienne de reference directe sur l'autre.
  useEffect(() => {
    function onFocusSearch() {
      inputRef.current?.focus();
    }
    window.addEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
  }, []);

  function toggleGroup(group: EntityTypeGroup) {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

  // Regroupement par categorie (KAN-36 P3 point 5), memes 8 groupes que le
  // combobox de creation et les filtres du graphe (groupedEntityTypes(),
  // ordre stable) - un type sans groupe connu (donnee legacy) tombe dans
  // "Divers", meme repli que EntityTypeIcon. Un groupe sans entite
  // correspondante ne s'affiche pas du tout.
  const isSearching = query.trim().length > 0;
  const groupedResults = groupedEntityTypes()
    .map(({ group }) => ({
      group,
      entities: results.filter((entity) => (entityTypeGroup(entity.type) ?? "Divers") === group),
    }))
    .filter(({ entities }) => entities.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="entity-search" className="sr-only">
          Rechercher une entrée
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden="true" className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            type="search"
            id="entity-search"
            name="entity-search"
            placeholder="Rechercher une entrée…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              scheduleSearch(event.target.value);
            }}
          />
        </InputGroup>
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
          {query.trim().length === 0 ? "Aucune entrée pour le moment." : "Aucune entité trouvée."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groupedResults.map(({ group, entities }, index) => {
            // Pendant une recherche active, l'etat replie est ignore a
            // l'affichage (confirme avec Aymeric) - jamais modifie par la
            // recherche elle-meme, seulement par un clic sur l'en-tete.
            const isOpen = isSearching || !collapsedGroups.has(group);
            const panelId = `sidebar-group-panel-${index}`;
            return (
              <div key={group}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span>{group}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("size-4 shrink-0 transition-transform", !isOpen && "-rotate-90")}
                  />
                </button>
                {isOpen ? (
                  <ul id={panelId} className="flex flex-col gap-2 pt-1">
                    {entities.map((entity) => (
                      <li key={entity.id}>
                        <Link
                          href={`/worlds/${worldSlug}/entities/${entity.id}`}
                          className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <Card className="flex-row items-center justify-between px-4 py-3 transition-colors hover:bg-accent">
                            <span className="flex min-w-0 items-center gap-2">
                              <EntityTypeIcon type={entity.type} />
                              <span className="truncate text-sm font-medium text-foreground">
                                {entity.name}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-normal text-muted-foreground">
                              {entityTypeLabel(entity.type)}
                            </span>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
