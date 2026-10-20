"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorldTypeCatalog } from "@/lib/entity-types";

// Catalogue des types du monde (KAN-81) cote client : charge une fois par le
// layout serveur (getWorldTypeCatalog), pose par ce Provider autour de
// WorldShell (layout.tsx) - tous les Client Components du monde (sidebar,
// combobox, graphe, y compris ceux rendus par les pages enfants) le lisent
// sans prop drilling. Les Server Components (pages) appellent directement
// getWorldTypeCatalog (cache() React, meme requete).
const WorldTypeCatalogContext = createContext<WorldTypeCatalog | null>(null);

export function WorldTypeCatalogProvider({
  catalog,
  children,
}: {
  catalog: WorldTypeCatalog;
  children: ReactNode;
}) {
  return (
    <WorldTypeCatalogContext.Provider value={catalog}>{children}</WorldTypeCatalogContext.Provider>
  );
}

// Absence de Provider = erreur de cablage (composant monte hors d'un monde),
// jamais un catalogue vide silencieux qui masquerait les types personnalises.
export function useWorldTypeCatalog(): WorldTypeCatalog {
  const catalog = useContext(WorldTypeCatalogContext);
  if (!catalog) {
    throw new Error("useWorldTypeCatalog appele hors de WorldTypeCatalogProvider.");
  }
  return catalog;
}
