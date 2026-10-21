# ADR-0030 — Types d'entrées personnalisés par monde

- **Statut** : accepté
- **Date** : 2026-10-20
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Les 26 types d'entrées sont figés dans le code (`src/lib/entity-schemas.ts`,
KAN-18), rangés en 8 groupes. `Entity.type` est un `String` en base, jamais
un enum Prisma : c'est un invariant du projet (le type est une donnée).
KAN-81 (lot A de la refonte « paramétrer son monde ») demande deux choses :

- un utilisateur doit pouvoir créer **ses propres types** dans un monde
  (« Vaisseau » dans un space opera) ;
- il doit pouvoir **masquer les types natifs** qu'il n'utilise pas, sans
  toucher aux entrées qui les portent déjà.

Trois contraintes encadrent la décision :

- les entrées existantes ne doivent pas changer ;
- la suppression d'un monde passe par une cascade en base, elle doit continuer
  à fonctionner ;
- un type d'un monde ne doit jamais être utilisable depuis un autre monde
  (OWASP A01).

## Options envisagées

- **A — Clé `custom:<id>` stockée dans `Entity.type`.** Aucune colonne
  ajoutée. Mais la base ne sait plus rien du lien : pas de clé étrangère,
  aucune garantie qu'un type supprimé ne laisse pas d'entrées orphelines, et
  chaque lecture doit décoder la chaîne.
- **B — Tout en base : 26 types natifs semés dans chaque monde.** Le modèle
  devient uniforme, mais il faut une migration de données pour chaque monde
  existant. Les libellés natifs deviennent modifiables par monde, ce qui sort
  du périmètre. Et chaque nouveau type natif oblige à resemer tous les mondes.
- **C — Groupes personnalisés en plus des types.** Hors périmètre (KAN-81 le
  refuse explicitement) : la couleur des nœuds du graphe est portée par les
  8 groupes (palette validée, C2.2.3).
- **D — Registre natif en code + table `CustomEntityType` + sentinelle.**
  Les natifs restent en code. Une table porte les types personnalisés, et une
  entrée personnalisée porte `type = "custom"` et `customTypeId`.

## Décision

**Option D.**

- **Registre natif inchangé** dans `entity-schemas.ts`.
- **Table `CustomEntityType`** (`worldId`, `label` en NFC, `labelKey`,
  `group`, `icon`), en cascade depuis `World`.
- **`Entity.customTypeId`** est une clé étrangère en **`ON DELETE NO
  ACTION`**, et non `RESTRICT`. PostgreSQL vérifie `RESTRICT` immédiatement,
  ce qui ferait échouer la suppression d'un monde : les cascades World → Entity
  et World → CustomEntityType partent de la même instruction. `NO ACTION` est
  vérifié en fin d'instruction : la suppression d'un monde passe, la
  suppression directe d'un type encore utilisé échoue. Prouvé sur la base de
  dev le 2026-10-20 (script jetable, transaction annulée) et couvert par l'e2e
  `world-settings.spec.ts`.
- **Contrainte `CHECK`** posée en SQL dans la migration :
  `("type" = 'custom') = ("customTypeId" IS NOT NULL)`. Prisma ne sait pas la
  déclarer ; `prisma migrate diff` reste vide après la migration, donc pas de
  dérive.
- **Unicité du libellé** dans le monde, insensible à la casse et aux accents.
  `labelKey = normalizeForMatch(label)` porte `@@unique([worldId, labelKey])`.
  Prisma la déclare nativement, sans index sur expression (`unaccent` n'est
  pas `IMMUTABLE`). La collision avec les 26 libellés natifs est vérifiée dans
  le service.
- **`World.hiddenEntityTypes String[]`** : liste des clés natives masquées à
  la création. Garde serveur : au moins un type proposable reste toujours
  disponible.
- **Un résolveur unique**, `src/lib/entity-types.ts` (TS pur) :
  `resolveEntityType` renvoie la clé d'affichage (native ou `custom:<id>`,
  jamais stockée), le libellé, le groupe et l'icône. Tous les affichages
  passent par lui. Le catalogue d'un monde est chargé en une requête par rendu
  (`cache()` de React) et transmis aux composants clients par un contexte.

## Conséquences

**Positives :**

- Les entrées existantes restent intactes (migration additive).
- La base garantit seule l'intégrité : pas d'orphelin, pas de type `custom`
  sans id, pas de type d'un autre monde. Ce dernier point est aussi vérifié
  dans le service.
- Les couleurs du graphe sont inchangées (le type personnalisé hérite de son
  groupe).
- Ajouter un type natif ne demande toujours aucune migration.

**Négatives (dette assumée) :**

- Deux chemins de lecture (natif et personnalisé) que le résolveur unifie.
  Un affichage qui lit `entity.type` sans passer par lui afficherait
  « custom » ; c'est la règle de revue à tenir.
- Supprimer un type utilisé impose une réaffectation explicite, dans une
  transaction. La carte envoyée doit couvrir exactement les entrées du type,
  sinon le serveur la refuse et demande de recharger.
- Le sélecteur chaîne de Cytoscape ne sait pas représenter un `"` dans une
  valeur. Le filtre du graphe compare donc `node.data("typeKey")` au lieu de
  construire un sélecteur : il n'y a rien à échapper.

**Suite :** le lot B (types de relation, KAN-70) réutilise la page
`/worlds/[slug]/settings` et le même patron (registre natif + table
personnalisée + résolveur).

## Compétence(s) servie(s)

C2.2.1 (architecture en couches, résolveur pur testé), C2.2.3 (OWASP A01 :
appartenance du type au monde), C2.4.1 (traçabilité de la décision).
