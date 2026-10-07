---
name: prisma-updatedat-system-write
description: >
  Écriture « système » (worker, compteur, flag de scan, comptabilité interne)
  sur un modèle Prisma qui porte un champ @updatedAt signifiant « dernière
  modification par l'utilisateur ». Déclencheurs : @updatedAt, updateMany,
  update, updatedAt déplacé, date modifiée le, tri par updatedAt, worker écrit
  en base, scannedVersion, $executeRaw, SQL brut paramétré, garde anti-recul,
  template tagué.
---

# `@updatedAt` bouge sur **tout** `update`/`updateMany` — y compris ceux du système

## Le symptôme

Un worker (ou un job) écrit un champ technique sur une fiche, et la date
« modifiée le » affichée et triée au dashboard saute, alors que l'auteur n'a
rien touché.

## La cause

Prisma renseigne `@updatedAt` **côté client** à chaque `update` / `updateMany`,
quel que soit le champ modifié. Il ne distingue pas une édition utilisateur
d'une écriture de comptabilité. Relire `updatedAt` puis le réécrire crée une
course avec un vrai save.

## La solution

Passer sous Prisma avec une requête paramétrée (template tagué = aucune
interpolation de chaîne), et en profiter pour poser la garde métier :

```ts
const markScanned = prisma.$executeRaw`UPDATE "Entity"
  SET "scannedVersion" = ${version}
  WHERE "id" = ${entityId} AND "scannedVersion" < ${version}`;
```

Le `WHERE … < version` évite tout recul si deux jobs se chevauchent. Mettre
l'instruction dans la même `$transaction` que le reste du job si elle doit
être atomique avec lui.

## Règle

Avant d'écrire sur un modèle à `@updatedAt`, demander : « cette écriture
est-elle une action de l'utilisateur ? ». Si non → SQL brut paramétré, et un
test qui vérifie que `updatedAt` est intact. Repéré à la lecture du schéma,
pas après le bug.
