import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import type { WorldTypeCatalog } from "@/lib/entity-types";
import { WorldTypeCatalogProvider } from "@/app/(app)/worlds/[slug]/world-type-catalog";

export const EMPTY_TYPE_CATALOG: WorldTypeCatalog = { custom: [], hidden: [] };

// Rendu d'un composant du monde (KAN-81) : pose le catalogue des types en
// contexte, comme le layout du monde en vrai (layout.tsx). Catalogue vide par
// defaut = les 26 types natifs, aucun masque, aucun personnalise.
export function renderInWorld(
  ui: ReactElement,
  { catalog = EMPTY_TYPE_CATALOG, ...options }: RenderOptions & { catalog?: WorldTypeCatalog } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <WorldTypeCatalogProvider catalog={catalog}>{children}</WorldTypeCatalogProvider>
    ),
    ...options,
  });
}
