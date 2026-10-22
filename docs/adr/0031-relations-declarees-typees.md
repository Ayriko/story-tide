# ADR-0031 — Relations déclarées et typées

- **Statut** : accepté
- **Date** : 2026-10-22
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Jusqu'ici, un lien entre deux entrées n'existe que comme **reflet du texte** :

- `Relation` origin `AUTO` est écrite par le worker (scan Aho-Corasick) ;
- `Relation` origin `MANUAL` est écrite par la sauvegarde d'une fiche
  (`reconcileManualMentions`, ADR-0011), qui **supprime** toute relation
  MANUAL dont la cible n'est plus citée par `@`.

L'auteur ne peut donc pas poser un lien qui ne soit pas porté par une
mention (« Selyne, Parent de, Aldric »), ni dire de quelle nature est ce lien.
KAN-84 (lot B de la refonte « paramétrer son monde ») demande :

- des relations **déclarées** par l'auteur, **typées**, visibles sur les deux
  fiches et dans la Constellation ;
- des types natifs et des **types personnalisés par monde**, symétriques
  (« Allié ») ou dirigés (« Parent de » / « Enfant de ») ;
- des **suggestions** qui transforment en un clic une entrée citée dans le
  texte en relation.

Contraintes : ne rien changer à `Relation`, `RelationOrigin`, `LinkIgnore`,
au worker ni à `reconcileManualMentions` (une sauvegarde de texte ne doit
jamais toucher une relation déclarée) ; la suppression d'un monde doit
continuer à passer par la cascade ; un type ou une entrée d'un autre monde ne
doit jamais être utilisable (OWASP A01).

## Options envisagées

- **A — Valeur `DECLARED` ajoutée à `RelationOrigin`, type en colonne de
  `Relation`.** Une seule table de liens. Mais l'unicité actuelle
  (`sourceId, targetId, origin`) devrait intégrer un type nullable : un index
  unique PostgreSQL traite deux `NULL` comme distincts, il faudrait un index
  partiel par origine. Surtout, `reconcileManualMentions` et le worker
  filtrent par origine : chaque requête existante deviendrait un risque de
  régression sur le différenciateur produit.
- **B — Type porté par la mention dans le texte** (attribut du node mention
  Tiptap). Aucune table. Mais la relation disparaîtrait avec la mention, ce
  qui est exactement le défaut à corriger, et le schéma de contenu validé
  serveur (ADR-0009) s'alourdirait.
- **C — Liste de types fixe, sans types personnalisés.** Plus simple, mais
  contredit le besoin (un monde de fantasy n'a pas les relations d'un space
  opera) et le lot A a déjà posé le patron pour les types d'entrées.
- **D — Table séparée `DeclaredRelation`, types sur le patron d'ADR-0030.**
  Les reflets du texte restent intacts ; les relations déclarées vivent à
  part et sont fusionnées seulement à l'affichage.

## Décision

**Option D.**

- **Table `DeclaredRelation`** (`worldId`, `sourceId`, `targetId`,
  `relationType`, `customRelationTypeId`, `typeKey`), en cascade depuis
  `World` et depuis chaque `Entity`. Aucun module qui écrit `Relation` ne
  l'importe : `relation-service.ts` et `linker-service.ts` ne la
  connaissent pas, et deux tests le prouvent (aucun appel à
  `prisma.declaredRelation` pendant `reconcileManualMentions` et
  `scanAndLinkEntity`).
- **Types : patron ADR-0030.** Registre natif en code
  (`src/lib/relation-types.ts`, 6 symétriques et 8 dirigés avec leur
  libellé inverse), table `CustomRelationType` (`label` en NFC, `labelKey`,
  `symmetric`, `inverseLabel`), sentinelle `relationType = "custom"`,
  `World.hiddenRelationTypes` pour masquer un natif. Un résolveur pur
  unique (`resolveRelationType`) et un catalogue chargé une fois par rendu
  (`getWorldRelationTypeCatalog`, `cache()`).
- **`typeKey`** (clé native ou `custom:<id>`) porte l'unicité
  `@@unique([sourceId, targetId, typeKey])` : une paire peut porter
  plusieurs types, jamais deux fois le même. Il évite l'index unique sur
  colonne nullable de l'option A.
- **Symétrie ordonnée** : une relation symétrique est stockée avec
  `sourceId < targetId`. « A allié de B » et « B allié de A » tombent sur la
  même ligne, le doublon est refusé par l'index.
- **Sens choisi depuis la fiche** : le select propose deux options par type
  dirigé (« Parent de », « Enfant de »), la valeur porte le point de vue
  (`<clé>|source` ou `<clé>|target`). Le libellé affiché est toujours lu
  depuis la fiche courante (`labelFrom`).
- **Base garante de l'intégrité**, en SQL écrit à la main dans la migration
  (Prisma ne déclare pas de `CHECK`) :
  - `DeclaredRelation_custom_type_check` : `custom` si et seulement si
    `customRelationTypeId` est renseigné ;
  - `DeclaredRelation_type_key_check` : `typeKey` toujours égal à la clé
    dérivée, jamais désynchronisé ;
  - `DeclaredRelation_no_self_check` : pas de relation d'une entrée avec
    elle-même ;
  - `CustomRelationType_symmetric_check` : symétrique si et seulement si
    pas de libellé inverse ;
  - `customRelationTypeId` en **`ON DELETE NO ACTION`** (même raison qu'en
    ADR-0030 : la cascade de suppression d'un monde passe, la suppression
    directe d'un type utilisé échoue).
  Prouvé sur la base de dev le 2026-10-22 (script jetable en
  `BEGIN … ROLLBACK`, chaque contrainte violée une fois) ;
  `prisma migrate diff` vide après migration.
- **Libellés uniques** dans le monde, insensibles à la casse et aux accents,
  **inverses compris** : libellé et inverse sont comparés aux libellés et
  inverses natifs et personnalisés, et l'inverse doit différer du libellé.
- **Nature figée une fois utilisée** : un type personnalisé déjà porté par
  une relation ne peut plus passer de symétrique à dirigé (ni l'inverse) ;
  il faut créer un nouveau type et réaffecter. Sinon des relations
  existantes seraient retournées ou fusionnées sans que l'auteur le voie.
- **Suppression d'un type utilisé** : réaffectation explicite, relation par
  relation, vers un type **de même nature**, dans une transaction. La carte
  doit couvrir exactement les relations du type. Si la paire porte déjà le
  type cible, la relation est supprimée au lieu d'être dupliquée, et la
  fenêtre l'annonce avant validation (« Déjà présente : sera supprimée. »).
- **Constellation : une arête par paire.** Mentions et relations déclarées
  d'une même paire fusionnent en une arête (`pair:<a>~<b>`). La relation
  déclarée est prioritaire : trait plein et libellé ; une paire seulement
  citée reste en pointillés. Flèche si et seulement si tous les liens de la
  paire vont dans le même sens. La liste accessible applique la même règle
  (« Parent de → Aldric »).
- **Suggestions** : entrées citées par la fiche (liens sortants AUTO ou
  MANUAL) sans relation déclarée, dans un sens ou l'autre. Une table en code
  (`src/lib/relation-suggestions.ts`) pré-sélectionne un type selon les
  groupes source/cible (Personnage → Lieu : « Situé dans »). « Ignorer » est
  stocké par fiche (`RelationSuggestionIgnore`), réversible.
- **Affichages blindés** : les composants reçoivent des DTO à type déjà
  résolu (`DeclaredRelationView`, `EntityListItem`), jamais `relationType`,
  `type` ni `customTypeId` bruts.

## Conséquences

**Positives :**

- Le moteur de liaison et les mentions manuelles restent strictement
  inchangés : aucun risque de régression sur le différenciateur produit.
- Une relation déclarée survit à toute réécriture du texte.
- La base refuse seule les états incohérents (type orphelin, clé
  désynchronisée, auto-relation, symétrique avec inverse).
- Ajouter un type natif ne demande aucune migration.

**Négatives (dette assumée) :**

- Deux sources de liens (reflets du texte et relations déclarées), fusionnées
  à l'affichage par `buildGraphElements`. Un futur lecteur qui n'en lirait
  qu'une donnerait une vue partielle ; c'est la règle de revue à tenir.
- La fusion par paire masque, dans le graphe, le détail AUTO / MANUAL d'une
  paire déjà déclarée (il reste visible sur la fiche, section « Renvois »).
- Les contraintes `CHECK` ne sont prouvées qu'une fois, par script jetable :
  une preuve permanente (test d'intégration sur base réelle) est à prévoir
  avec celles d'ADR-0030 (KAN-83).

**Suite :** lot C — apparence des relations dans le graphe (couleurs par
type), filtres par type de relation, glisser pour lier.

## Compétence(s) servie(s)

C2.2.1 (architecture en couches, résolveur pur testé, séparation des
écritures), C2.2.3 (OWASP A01 : entrées et types du même monde), C2.4.1
(traçabilité de la décision).
