# ADR-0004 — Better Auth pour l'authentification email + mot de passe

- **Statut** : accepté
- **Date** : 2026-07-03
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Besoin d'une authentification email + mot de passe self-hosted, avec sessions en
base (révocables) et un adapter Prisma. Auth.js (NextAuth) décourage historiquement
les credentials providers self-hosted (orienté OAuth en priorité).

## Options envisagées

- **Auth.js / NextAuth** : écarté (credentials providers découragés, moins TS-first).
- **Better Auth** : retenu — TS-first, conçu pour les credentials self-hosted.
- **Implémentation maison** : écartée — surface de risque sécurité trop large pour
  un développeur solo sur un planning serré.

## Décision

Better Auth 1.6.23 (licence MIT, vérifiée à l'installation — réflexe systématique).
Adapter Prisma (`better-auth/adapters/prisma`), plugin `nextCookies()` pour que les
Server Actions posent correctement les cookies de session. Schéma de base généré via
le CLI Better Auth plutôt qu'écrit à la main (source de vérité pour les contraintes
uniques sur `email`/`token`, non détaillées dans la documentation publique).

## Conséquences

- **Positives** : hash de mot de passe géré (scrypt) ; sessions révocables en base ;
  cookies `HttpOnly`/`SameSite=Lax` ; messages d'erreur génériques disponibles
  nativement (anti-énumération de comptes).
- **Négatives (dette assumée)** : dépendance à un package tiers pour un composant
  sécurité critique — mitigé par la vérification systématique de version/licence et
  par des scénarios de recette dédiés (`TST-AUT-*`, `TST-SEC-001`).

## Compétence(s) servie(s)

C2.2.1 (patron d'architecture) ; C2.2.3 (A02, A07 — cf. `securite-owasp.md`) ;
C2.4.1. **Codé et vérifié** cette session (API réelle via curl + inspection Postgres).
