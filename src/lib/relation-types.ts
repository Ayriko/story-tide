// Resolveur UNIQUE du type d'une relation declaree (KAN-84, ADR-0031), sur le
// patron exact de entity-types.ts (ADR-0030) : TS pur, aucune dependance UI ni
// base. Le registre natif reste en code ; les types personnalises d'un monde
// arrivent par le catalogue, charge une fois par rendu (relation-type-service).

// Ordre d'affichage : symetriques puis diriges.
export const RELATION_TYPES = [
  "ally",
  "friend",
  "rival",
  "enemy",
  "family",
  "spouse",
  "parent",
  "mentor",
  "member",
  "leads",
  "located",
  "owns",
  "created",
  "worships",
] as const;

export type NativeRelationType = (typeof RELATION_TYPES)[number];

// inverseLabel null = type symetrique (« Allie » se lit pareil des deux
// fiches) ; sinon libelle lu depuis la CIBLE (Selyne « Parent de » Aldric,
// Aldric « Enfant de » Selyne).
export const RELATION_TYPE_REFERENCE: Record<
  NativeRelationType,
  { label: string; inverseLabel: string | null }
> = {
  ally: { label: "Allié", inverseLabel: null },
  friend: { label: "Ami", inverseLabel: null },
  rival: { label: "Rival", inverseLabel: null },
  enemy: { label: "Ennemi", inverseLabel: null },
  family: { label: "Famille", inverseLabel: null },
  spouse: { label: "Conjoint", inverseLabel: null },
  parent: { label: "Parent de", inverseLabel: "Enfant de" },
  mentor: { label: "Mentor de", inverseLabel: "Élève de" },
  member: { label: "Membre de", inverseLabel: "Compte parmi ses membres" },
  leads: { label: "Dirige", inverseLabel: "Dirigé par" },
  located: { label: "Situé dans", inverseLabel: "Contient" },
  owns: { label: "Possède", inverseLabel: "Appartient à" },
  created: { label: "A créé", inverseLabel: "Créé par" },
  worships: { label: "Vénère", inverseLabel: "Vénéré par" },
};

// Sentinelle stockee dans DeclaredRelation.relationType pour une relation d'un
// type personnalise (customRelationTypeId renseigne - CHECK en base).
export const CUSTOM_RELATION_TYPE = "custom";

export type CustomRelationTypeDTO = {
  id: string;
  label: string;
  inverseLabel: string | null;
  symmetric: boolean;
};

export type WorldRelationTypeCatalog = { custom: CustomRelationTypeDTO[]; hidden: string[] };

export type ResolvedRelationType = {
  // Cle native ou `custom:<id>` - identique a DeclaredRelation.typeKey.
  key: string;
  label: string;
  // null si et seulement si symmetric.
  inverseLabel: string | null;
  symmetric: boolean;
  isCustom: boolean;
  isHidden: boolean;
};

// Fiche depuis laquelle on lit la relation : sa source ou sa cible.
export type RelationViewpoint = "source" | "target";

const CUSTOM_KEY_PREFIX = "custom:";

export function customRelationTypeKey(customRelationTypeId: string): string {
  return `${CUSTOM_KEY_PREFIX}${customRelationTypeId}`;
}

export function isNativeRelationType(type: string): type is NativeRelationType {
  return (RELATION_TYPES as readonly string[]).includes(type);
}

// Inverse de la cle d'affichage (formulaires, cartes de reaffectation). null
// pour une cle inconnue - au schema Zod de la frontiere de rejeter.
export function parseRelationTypeKey(
  key: string,
): { relationType: string; customRelationTypeId: string | null } | null {
  if (key.startsWith(CUSTOM_KEY_PREFIX)) {
    const customRelationTypeId = key.slice(CUSTOM_KEY_PREFIX.length);
    return customRelationTypeId.length > 0
      ? { relationType: CUSTOM_RELATION_TYPE, customRelationTypeId }
      : null;
  }
  return isNativeRelationType(key) ? { relationType: key, customRelationTypeId: null } : null;
}

function resolveNative(type: NativeRelationType, hidden: readonly string[]): ResolvedRelationType {
  const { label, inverseLabel } = RELATION_TYPE_REFERENCE[type];
  return {
    key: type,
    label,
    inverseLabel,
    symmetric: inverseLabel === null,
    isCustom: false,
    isHidden: hidden.includes(type),
  };
}

function resolveCustom(custom: CustomRelationTypeDTO): ResolvedRelationType {
  // Le CHECK en base garantit symmetric <=> inverseLabel NULL ; un libelle
  // inverse absent sur un dirige retomberait sur le libelle, jamais sur vide.
  return {
    key: customRelationTypeKey(custom.id),
    label: custom.label,
    inverseLabel: custom.symmetric ? null : (custom.inverseLabel ?? custom.label),
    symmetric: custom.symmetric,
    isCustom: true,
    isHidden: false,
  };
}

function unknownType(key: string): ResolvedRelationType {
  return {
    key,
    label: "Type inconnu",
    inverseLabel: null,
    symmetric: true,
    isCustom: true,
    isHidden: false,
  };
}

export function resolveRelationType(
  relation: { relationType: string; customRelationTypeId: string | null },
  catalog: WorldRelationTypeCatalog,
): ResolvedRelationType {
  if (relation.relationType !== CUSTOM_RELATION_TYPE) {
    if (isNativeRelationType(relation.relationType)) {
      return resolveNative(relation.relationType, catalog.hidden);
    }
    console.error("[relation-types] Type de relation natif inconnu :", {
      relationType: relation.relationType,
    });
    return unknownType(relation.relationType);
  }
  const custom = catalog.custom.find((candidate) => candidate.id === relation.customRelationTypeId);
  if (custom) {
    return resolveCustom(custom);
  }
  // Ne doit pas arriver (FK + CHECK en base) : catalogue perime ou donnee
  // incoherente - affichage degrade mais trace, jamais avale.
  console.error("[relation-types] Type de relation personnalise introuvable :", {
    customRelationTypeId: relation.customRelationTypeId,
  });
  return unknownType(
    relation.customRelationTypeId
      ? customRelationTypeKey(relation.customRelationTypeId)
      : CUSTOM_RELATION_TYPE,
  );
}

// Libelle lu depuis l'une ou l'autre fiche : l'inverse depuis la cible d'une
// relation dirigee, le libelle partout ailleurs.
export function labelFrom(resolved: ResolvedRelationType, viewpoint: RelationViewpoint): string {
  return viewpoint === "target" && resolved.inverseLabel !== null
    ? resolved.inverseLabel
    : resolved.label;
}

// Tous les types connus du monde : natifs dans l'ordre du registre, puis
// personnalises par libelle.
export function allRelationTypes(catalog: WorldRelationTypeCatalog): ResolvedRelationType[] {
  const custom = [...catalog.custom]
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))
    .map(resolveCustom);
  return [...RELATION_TYPES.map((type) => resolveNative(type, catalog.hidden)), ...custom];
}

// Choix d'un type DEPUIS une fiche : la cle du type + le point de vue de la
// fiche courante (« Enfant de » sur Aldric = parent, vu depuis la cible).
// Valeur d'option `<cle>|<point de vue>` : une cle native n'a jamais de « | »,
// un id cuid non plus.
export type RelationChoice = { key: string; viewpoint: RelationViewpoint };

export type RelationTypeOption = RelationChoice & {
  value: string;
  label: string;
  isCustom: boolean;
};

export function relationChoiceValue({ key, viewpoint }: RelationChoice): string {
  return `${key}|${viewpoint}`;
}

export function parseRelationChoice(value: string): RelationChoice | null {
  const separator = value.lastIndexOf("|");
  if (separator <= 0) {
    return null;
  }
  const key = value.slice(0, separator);
  const viewpoint = value.slice(separator + 1);
  if (parseRelationTypeKey(key) === null) {
    return null;
  }
  return viewpoint === "source" || viewpoint === "target" ? { key, viewpoint } : null;
}

function optionOf(type: ResolvedRelationType, viewpoint: RelationViewpoint): RelationTypeOption {
  return {
    key: type.key,
    viewpoint,
    value: relationChoiceValue({ key: type.key, viewpoint }),
    label: labelFrom(type, viewpoint),
    isCustom: type.isCustom,
  };
}

// Types proposables depuis une fiche (natifs masques exclus), en deux
// groupes : un symetrique = une option, un dirige = deux (son libelle et son
// inverse), pour que l'auteur choisisse le sens depuis la fiche ou il est.
export function selectableRelationTypes(catalog: WorldRelationTypeCatalog): {
  symmetric: RelationTypeOption[];
  directed: RelationTypeOption[];
} {
  const selectable = allRelationTypes(catalog).filter((type) => !type.isHidden);
  return {
    symmetric: selectable.filter((type) => type.symmetric).map((type) => optionOf(type, "source")),
    directed: selectable
      .filter((type) => !type.symmetric)
      .flatMap((type) => [optionOf(type, "source"), optionOf(type, "target")]),
  };
}
