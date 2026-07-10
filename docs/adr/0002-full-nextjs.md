# ADR-0002 — Full Next.js (monolithe, pas de backend séparé, pas de tRPC)

- **Statut** : accepté
- **Date** : 2026-07-02
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Story Tide a besoin d'un backend capable de porter une logique métier conséquente
(moteur de liaison, graphe, quotas) et du temps différé (jobs async). Le choix se
posait entre une architecture full-stack Next.js (RSC + Server Actions) et un split
frontend Next.js / backend séparé (ex. NestJS), sur un planning solo très contraint
(3-24 juillet).

## Options envisagées

- **Next.js full-stack** (RSC + Server Actions, Zod aux frontières) : un seul service,
  une seule image, les RSC lisent Prisma directement.
- **Frontend Next.js + backend NestJS séparé** : séparation plus classique, mais
  double déploiement, duplication des types/contrats entre front et back.
- **tRPC par-dessus Next.js** : évalué puis écarté — redondant avec la sûreté déjà
  apportée par les Server Actions + Zod du full-Next.

## Décision

Full Next.js : RSC + Server Actions, Zod à toutes les frontières, pas de tRPC, pas de
backend séparé. Arbitrage complet vs NestJS tracé le 2026-07-02 (dev-log).

## Conséquences

- **Positives** : un seul service à déployer/superviser ; typage de bout en bout sans
  couche API intermédiaire ; itération rapide adaptée à un développeur solo.
- **Négatives (dette assumée)** : logique métier et UI dans le même repo/process —
  mitigé par les couches strictes `app/ → src/actions → src/services → src/db`.

## Compétence(s) servie(s)

C2.2.1 (framework et paradigmes) ; C2.4.1 (traçabilité).
