import { suggestRelationChoice } from "./relation-suggestions";
import {
  allRelationTypes,
  relationChoiceValue,
  selectableRelationTypes,
  type RelationTypeOption,
  type WorldRelationTypeCatalog,
} from "./relation-types";

// Lier deux etoiles depuis la Constellation (KAN-87, ADR-0032) : A est
// l'etoile de depart du geste, B celle d'arrivee. Le sens d'une relation
// dirigee est TOUJOURS choisi par l'auteur dans la boite (jamais deduit du
// geste) ; ces fonctions pures traduisent ce choix vers l'action existante
// de KAN-84 (createDeclaredRelationAction), ecrite du point de vue d'une
// fiche : la fiche est A, l'autre entree B.

export type LinkDirection = "a-to-b" | "b-to-a";

export type LinkEnd = { id: string; key: string; group: string };

// Types proposables, UNE option par type (le select de la fiche liste un
// dirige deux fois, libelle et inverse ; ici le sens est un choix separe).
export function linkRelationTypeOptions(catalog: WorldRelationTypeCatalog): {
  symmetric: RelationTypeOption[];
  directed: RelationTypeOption[];
} {
  const options = selectableRelationTypes(catalog);
  return {
    symmetric: options.symmetric,
    directed: options.directed.filter((option) => option.viewpoint === "source"),
  };
}

export function isSymmetricRelationType(catalog: WorldRelationTypeCatalog, key: string): boolean {
  return allRelationTypes(catalog).find((type) => type.key === key)?.symmetric ?? true;
}

// Pre-selection : la table des suggestions de KAN-84, essayee dans les deux
// orientations de la paire (A cite B, puis B cite A). Sens par defaut :
// celui de la regle trouvee, sinon A -> B (decide par l'appelant).
export function preselectRelation(
  a: LinkEnd,
  b: LinkEnd,
  catalog: WorldRelationTypeCatalog,
): { key: string; direction: LinkDirection } | null {
  const forward = suggestRelationChoice(a, b, catalog);
  if (forward) {
    return { key: forward.key, direction: forward.viewpoint === "source" ? "a-to-b" : "b-to-a" };
  }
  const backward = suggestRelationChoice(b, a, catalog);
  if (backward) {
    return { key: backward.key, direction: backward.viewpoint === "source" ? "b-to-a" : "a-to-b" };
  }
  return null;
}

// Champs de createDeclaredRelationAction : A est la fiche, le point de vue
// dit si A est la source (A -> B) ou la cible (B -> A). Une symetrique n'a
// pas de sens - l'ordre source/cible par id est fixe par le service.
export function linkFormFields(
  a: string,
  b: string,
  key: string,
  symmetric: boolean,
  direction: LinkDirection,
): { entityId: string; otherId: string; choice: string } {
  const viewpoint = symmetric || direction === "a-to-b" ? "source" : "target";
  return { entityId: a, otherId: b, choice: relationChoiceValue({ key, viewpoint }) };
}
