"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Leaf,
  MapPin,
  Package,
  Search,
  Shield,
  StickyNote,
  User,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { searchEntitiesAction } from "@/actions/entity";
import { entityTypeGroup, entityTypeLabel, type EntityTypeGroup } from "@/lib/entity-schemas";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import type { EntitySearchResult } from "@/services/entity-service";

const SEARCH_DEBOUNCE_MS = 300;

// Icone PAR GROUPE (8 familles), pas par type individuel - meme rationale que
// la couleur des noeuds du graphe (26 icones distinctes n'apporterait rien de
// plus lisible, cf. entity-schemas.ts). Le libelle textuel du type reste
// affiche a cote (jamais l'icone seule - RGAA, l'info n'est pas dans la
// couleur/forme seule).
const GROUP_ICON: Record<EntityTypeGroup, LucideIcon> = {
  Personnages: User,
  Écologie: Leaf,
  Lieux: MapPin,
  Organisation: Shield,
  Magie: Wand2,
  Lore: BookOpen,
  Objets: Package,
  Divers: StickyNote,
};

function EntityTypeIcon({ type }: { type: string }) {
  const group = entityTypeGroup(type);
  const Icon = group ? GROUP_ICON[group] : StickyNote;
  return <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
}

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
        <Label htmlFor="entity-search" className="sr-only">
          Rechercher une fiche
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden="true" className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            id="entity-search"
            name="entity-search"
            placeholder="Rechercher une fiche…"
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
      )}
    </div>
  );
}
