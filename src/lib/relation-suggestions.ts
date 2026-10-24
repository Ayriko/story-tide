import type { EntityTypeGroup } from "./entity-schemas";
import {
  allRelationTypes,
  type RelationChoice,
  type WorldRelationTypeCatalog,
} from "./relation-types";

// Pre-selection du type d'une suggestion de relation (KAN-84) : table EN CODE,
// par groupe de l'entree source (la fiche qui cite) -> groupe de la cible
// (l'entree citee). Le point de vue est celui de la fiche qui cite : « target »
// = la fiche est la CIBLE de la relation creee (un objet « Appartient a » la
// personne : relation personne -owns-> objet). Un type perso compte comme son
// groupe (resolvedType.group). Personnages -> Personnages, et tout le reste :
// aucune pre-selection, l'auteur choisit.
type SuggestionRule = {
  source: EntityTypeGroup;
  target: EntityTypeGroup;
  // Type de cible precis exige quand le groupe ne suffit pas (une divinite
  // dans Lore, pas une prophetie).
  targetType?: string;
  choice: RelationChoice;
};

const SUGGESTION_RULES: readonly SuggestionRule[] = [
  { source: "Personnages", target: "Lieux", choice: { key: "located", viewpoint: "source" } },
  {
    source: "Personnages",
    target: "Organisation",
    choice: { key: "member", viewpoint: "source" },
  },
  {
    source: "Personnages",
    target: "Lore",
    targetType: "deity",
    choice: { key: "worships", viewpoint: "source" },
  },
  { source: "Objets", target: "Personnages", choice: { key: "owns", viewpoint: "target" } },
  { source: "Lieux", target: "Lieux", choice: { key: "located", viewpoint: "source" } },
];

// Seuls le groupe et la cle du type resolu comptent : appelable aussi depuis
// la Constellation (KAN-87), dont les etoiles ne portent que ces deux champs.
type SuggestionEntityType = { key: string; group: string };

// null si aucune regle ne s'applique, ou si le type pre-selectionne est
// masque (ou inconnu) dans ce monde : on ne propose jamais un type que le
// select n'offre pas.
export function suggestRelationChoice(
  source: SuggestionEntityType,
  target: SuggestionEntityType,
  catalog: WorldRelationTypeCatalog,
): RelationChoice | null {
  const rule = SUGGESTION_RULES.find(
    (candidate) =>
      candidate.source === source.group &&
      candidate.target === target.group &&
      (candidate.targetType === undefined || candidate.targetType === target.key),
  );
  if (!rule) {
    return null;
  }
  const type = allRelationTypes(catalog).find((candidate) => candidate.key === rule.choice.key);
  return type && !type.isHidden ? rule.choice : null;
}
