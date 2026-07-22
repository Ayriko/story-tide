# ADR-0022 — Monde d'introduction « Atheraus » : fonction de clonage partagée, pas de template en base

- **Statut** : accepté
- **Date** : 2026-07-22
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-35 demande qu'à l'inscription, chaque nouveau compte reçoive un monde d'exemple
« Atheraus » (25 entités rédigées à l'avance, bible + 2 lots de fiches) déjà peuplé et
déjà lié — vitrine immédiate du différenciateur produit (liaison automatique) sans que
l'utilisateur ait à rien écrire. Le socle nécessaire avait été anticipé dès KAN-18/KAN-19
(18/07) : `WorldOrigin.INTRO` (déjà exclu du quota, déjà exempté du plafond d'entités),
`Entity.seedRef` (`String?`, `@@unique([worldId, seedRef])`, provisionné et inutilisé
jusqu'ici), `AliasSource.SEED` (enum déjà prévu) — mais la pièce manquante (comment
matérialiser ce monde, et où) restait entièrement à trancher.

Contrainte dure du schéma (vérifiée, pas supposée) : `World.ownerId` est une FK
**non-nullable** vers `User`. Un `World` ne peut donc structurellement jamais être
partagé entre plusieurs comptes — toute option impliquant un monde unique visible par
tous était de fait exclue avant même d'être évaluée.

## Options envisagées

- **A — Monde template persisté + compte système** : un unique monde « Atheraus »
  appartenant à un compte système dédié, dupliqué (entités + relations) vers chaque
  nouvel utilisateur à l'inscription. Écartée : nécessite un mécanisme de duplication
  générique (entités **et** relations, y compris la distinction AUTO/MANUAL) qui
  n'existe nulle part dans le code actuel ; introduit un compte système à provisionner,
  protéger (ne doit jamais être un compte utilisable normalement) et maintenir ; le
  monde source devient un état mutable partagé dont toute dérive (édition accidentelle,
  suppression) casserait le clonage pour tous les comptes suivants — risque disproportionné
  pour un besoin de démonstration.
- **B — Fonction de clonage partagée, pilotée par un JSON versionné** (`seedIntroWorld`,
  `prisma/seed/atheraus.json`) — **retenue**. Le contenu des 25 entités vit dans un
  fichier JSON committé (source unique de vérité, pas de ligne en base à protéger) ;
  chaque appel de `seedIntroWorld(ownerId)` crée un monde `origin: INTRO` **frais et
  indépendant** pour ce compte (ids propres, éditable, supprimable comme n'importe quel
  monde de l'utilisateur) — jamais de monde partagé. La même fonction sert à la fois le
  CLI de vérification locale (`prisma/seed/run.ts`, §6.5 du contrat de seed) et
  `registerAction` : un seul chemin de matérialisation, jamais deux implémentations à
  garder synchronisées.
- **C — Génération de contenu à la volée (LLM, template paramétrique)** — jamais
  sérieusement envisagée : le contenu doit être fixe et relu (25 fiches déjà rédigées et
  validées par ailleurs), la reproductibilité du scénario de démonstration (cas 2 à 5 du
  contrat de seed : Selvenn ≠ Sel, Ansegar/Anségar → même cible, etc.) dépend d'un texte
  figé, pas généré à chaque inscription.

## Décision

Option B. Le JSON encode les 3 mentions manuelles connues (Guivre Saline, Selvenn,
Reliquaire du Verbe) comme des nœuds `{type: "mention", attrs: {seedRef, label}}` — jamais
un id Prisma en dur, puisque les ids réels n'existent qu'après insertion. `seedIntroWorld`
procède en deux passes : (1) création/upsert des 25 entités par `seedRef` (jamais le
slug), mentions temporairement dégradées en texte brut pour que le contenu persisté reste
un Tiptap valide indépendamment de la seconde passe ; (2) pour les seules entités portant
une mention, résolution `seedRef → id` réel et ré-écriture du contenu, puis appel de
`reconcileManualMentions` (fonction réelle du chemin utilisateur normal, jamais
réimplémentée) pour matérialiser les `Relation origin=MANUAL`. Un job de liaison est
ensuite enfilé explicitement par entité (`ENTITY_LINKING_QUEUE`, `singletonKey: entityId`)
— le seed ne passe pas par `saveEntityContentAction`, qui enfile normalement ce job.

**Couche service uniquement** (arbitrage explicitement demandé et rendu) :
`intro-world-service.ts` n'accède jamais directement à `prisma` — il appelle uniquement
`createIntroWorld` (nouvelle fonction dédiée dans `world-service.ts`, plutôt qu'un
paramètre `origin` public ajouté à `createWorld` : aucun appelant UI ne doit pouvoir
choisir l'origine d'un monde qu'il crée), `createSeedEntity` (nouvelle fonction dédiée
dans `entity-service.ts`, même normalisation NFC que `createEntity`/`updateEntity` —
BUG-005 — mais `source: AliasSource.SEED` et upsert par `seedRef`) et
`reconcileManualMentions` (déjà existante, inchangée). Ce sont des fonctions **séparées**
de `createWorld`/`createEntity`, pas des paramètres optionnels ajoutés à des fonctions
déjà appelées par le chemin utilisateur normal — la surface publique de ces deux
fonctions reste inchangée.

**Câblage inscription** : `registerAction` appelle `seedIntroWorld(userId)` après
`signUpEmail`, sauf si la case à cocher « Ne pas créer le monde d'exemple « Atheraus » »
(`register-form.tsx`, décochée par défaut — **opt-out**, décision explicite) est cochée.
Un échec du seed est loggué (`console.error`, jamais avalé) mais ne bloque jamais
l'inscription — même politique que l'enfilage de job dans `saveEntityContentAction`.
Latence mesurée en local (25 entités + enfilage de 25 jobs) : ~300 ms, deux mesures
concordantes — bien sous le seuil de 2 s fixé avant câblage, aucun besoin de dispatch
asynchrone ou de déclenchement différé après redirection.

**Schéma inchangé** : ni `Entity` ni `World` n'ont de colonne `summary`/`description` —
gap découvert en cours d'implémentation, pas anticipé en Phase 0. Faute de pouvoir
modifier le schéma dans cette session, le résumé de chaque fiche est replié comme
**premier paragraphe non-titré du corps** (`body`) plutôt que dans un champ dédié ;
`description` est purement et simplement abandonné des métadonnées du monde (ce champ
était une addition de confort, jamais mandatée par le contrat de seed).

## Conséquences

- **Positives** : aucun compte système à provisionner ni protéger ; le contenu source
  (JSON) est versionné, relu, diffable comme du code ; chaque compte a un monde
  entièrement indépendant (éditable, supprimable sans impact sur les autres comptes) ;
  la même fonction sert la vérification locale et la production, éliminant tout risque
  de divergence entre les deux chemins ; le seed passe par la couche service, donc par
  les mêmes garde-fous NFC (ADR-0020) et MANUAL que n'importe quelle écriture utilisateur
  normale.
- **Négatives / à surveiller** : le contenu des 25 fiches est figé dans le JSON — toute
  évolution éditoriale future nécessite de régénérer ce fichier (pas d'édition en base
  centralisée comme l'aurait permis un template partagé) ; l'absence de colonne
  `summary`/`description` dédiée signifie que le résumé de chaque entité n'est pas
  distinguable structurellement du reste du corps (limite acceptée pour cette session,
  pas un choix définitif si le schéma évolue plus tard).

## Compétence(s) servie(s)

C2.2.1 (architecture — couche service respectée, aucun accès Prisma direct hors service) ;
C2.2.2 (tests — trois fonctions nouvelles testées unitairement, couverture `src/services`
restaurée à 99,16 % après une chute passagère à 77,91 %) ; C2.3.1 (recette — `TST-AUT-009`,
`TST-LNK-009`, mise à jour de `TST-QOT-003`) ; C2.4.1 (traçabilité de la décision).
